import type { AppMode } from '../data/menuCatalog';
import type { StaffId } from '../data/restaurantStaff';

export type VoiceSpeakerId =
  | StaffId
  | 'all-team'
  | 'visitor-male'
  | 'visitor-female'
  | 'visitor';

export type DialogueScenario =
  | 'order_kasir'
  | 'kitchen_prep'
  | 'snack_bar_sync'
  | 'table_service'
  | 'warehouse_sync'
  | 'random';

export interface DialogueLine {
  speakerId: VoiceSpeakerId;
  speakerName: string;
  speakerRole: string;
  text: string;
}

export interface LiveDialogueResponse {
  scenario: Exclude<DialogueScenario, 'random'>;
  title: string;
  speakers: Array<{ id: VoiceSpeakerId; name: string; role: string }>;
  lines: DialogueLine[];
  audioBase64: string;
  mimeType: string;
}

const CHARACTER_SPEECH_TUNING: Record<
  VoiceSpeakerId,
  { pitch: number; rate: number }
> = {
  'raka-manager': { pitch: 0.9, rate: 0.98 },
  'sinta-kasir': { pitch: 1.15, rate: 1.05 },
  'dimas-chef': { pitch: 0.85, rate: 1.06 },
  'nadia-snack-bar': { pitch: 1.18, rate: 1.06 },
  'bima-server': { pitch: 1.02, rate: 1.04 },
  'tania-inventory': { pitch: 1.1, rate: 1.0 },
  'all-team': { pitch: 0.95, rate: 1.0 },
  'visitor-male': { pitch: 0.96, rate: 1.04 },
  'visitor-female': { pitch: 1.2, rate: 1.04 },
  visitor: { pitch: 1.0, rate: 1.04 },
};

class RestaurantVoicePlayer {
  private currentAudio: HTMLAudioElement | null = null;
  private queue: Array<{
    base64: string;
    onStart?: () => void;
    onEnd?: () => void;
  }> = [];
  private playing = false;
  private voiceEnabled = false;
  private listeners = new Set<(isPlaying: boolean) => void>();

  public subscribePlaying(cb: (isPlaying: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.playing));
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  public setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
  }

  public isPlaying(): boolean {
    const synthSpeaking =
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      window.speechSynthesis.speaking;
    return this.playing || synthSpeaking;
  }

  public stopAll() {
    this.queue = [];
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch {
        // ignore cleanup errors
      }
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.playing = false;
    this.notify();
  }

  // Zero-quota Indonesian Web Speech API voice for passive live restaurant ambient chatter
  public speakAmbientBrowserVoice(text: string, speakerId: VoiceSpeakerId) {
    if (!this.voiceEnabled) return;
    if (this.playing) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (window.speechSynthesis.speaking) return;

    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 180);
    if (!clean) return;

    try {
      const utter = new SpeechSynthesisUtterance(clean);
      const voices = window.speechSynthesis.getVoices();
      const idVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith('id')) ||
        voices.find((v) => v.lang.toLowerCase().includes('id'));
      if (idVoice) {
        utter.voice = idVoice;
      }
      utter.lang = 'id-ID';
      const tuning =
        CHARACTER_SPEECH_TUNING[speakerId] ?? CHARACTER_SPEECH_TUNING.visitor;
      utter.pitch = tuning.pitch;
      utter.rate = tuning.rate;
      utter.volume = 0.72;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore browser speech synthesis failures quietly
    }
  }

  public enqueueWav(
    base64: string,
    opts?: { interrupt?: boolean; onStart?: () => void; onEnd?: () => void }
  ) {
    if (!base64) return;
    if (opts?.interrupt) {
      this.stopAll();
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (this.queue.length >= 2) {
      this.queue.shift();
    }
    this.queue.push({
      base64,
      onStart: opts?.onStart,
      onEnd: opts?.onEnd,
    });
    if (!this.playing) {
      this.playNext();
    }
  }

  private playNext() {
    const item = this.queue.shift();
    if (!item) {
      this.playing = false;
      this.notify();
      return;
    }

    this.playing = true;
    this.notify();
    item.onStart?.();

    const audio = new Audio(`data:audio/wav;base64,${item.base64}`);
    this.currentAudio = audio;

    const finish = () => {
      if (this.currentAudio === audio) {
        this.currentAudio = null;
      }
      item.onEnd?.();
      this.playNext();
    };

    audio.onended = finish;
    audio.onerror = finish;

    void audio.play().catch(() => {
      finish();
    });
  }
}

export const voicePlayer = new RestaurantVoicePlayer();

const clientTtsCache = new Map<
  string,
  { audioBase64: string; mimeType: string; voiceName: string }
>();

export async function fetchSingleSpeakerTts(params: {
  text: string;
  speakerId: VoiceSpeakerId;
  style?: string;
}): Promise<{ audioBase64: string; mimeType: string; voiceName: string }> {
  const cacheKey = `${params.speakerId}|${params.text.trim()}`;
  const cached = clientTtsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const res = await fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Gagal memuat suara Gemini TTS.');
  }
  const result = json as {
    audioBase64: string;
    mimeType: string;
    voiceName: string;
  };
  if (clientTtsCache.size >= 40) {
    const oldest = clientTtsCache.keys().next().value;
    if (oldest) clientTtsCache.delete(oldest);
  }
  clientTtsCache.set(cacheKey, result);
  return result;
}

export async function fetchLiveDialogue(params: {
  scenario?: DialogueScenario;
  mode?: AppMode;
  customContext?: string;
}): Promise<LiveDialogueResponse> {
  const res = await fetch('/api/voice/dialogue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Gagal memuat dialog suara restoran.');
  }
  return json as LiveDialogueResponse;
}
