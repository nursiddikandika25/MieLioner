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
    return this.playing;
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
    this.playing = false;
    this.notify();
  }

  public enqueueWav(
    base64: string,
    opts?: { interrupt?: boolean; onStart?: () => void; onEnd?: () => void }
  ) {
    if (!base64) return;
    if (opts?.interrupt) {
      this.stopAll();
    }
    // Keep queue short so live background chatter doesn't lag behind
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

export async function fetchSingleSpeakerTts(params: {
  text: string;
  speakerId: VoiceSpeakerId;
  style?: string;
}): Promise<{ audioBase64: string; mimeType: string; voiceName: string }> {
  const res = await fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Gagal memuat suara Gemini TTS.');
  }
  return json as { audioBase64: string; mimeType: string; voiceName: string };
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
