import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Play,
  Pause,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Camera,
  Volume2,
  VolumeX,
  Sun,
  MessageSquareText,
} from 'lucide-react';
import type { AppMode, OrderType } from '../data/menuCatalog';
import { AI_STAFF_PROFILES, type StaffId } from '../data/restaurantStaff';
import {
  buildArticulatedCharacter,
  getStaffStyleConfig,
  getVisitorStyleConfig,
  type ArticulatedCharacter,
} from '../three/characterBuilder';
import { createContactShadowTexture } from '../three/proceduralTextures';
import {
  buildMieLionerScene,
  type RestaurantSceneLayout,
  type TableSeatSlot,
} from '../three/restaurantSceneBuilder';
import { restaurantSound } from '../three/soundEngine';
import {
  fetchSingleSpeakerTts,
  voicePlayer,
  type DialogueScenario,
  type VoiceSpeakerId,
} from '../three/voicePlayer';

export interface IncomingOrderSimEvent {
  nonce: number;
  orderType: OrderType;
  label: string;
}

export interface StaffCommandSimEvent {
  nonce: number;
  staffId: StaffId | 'all-team';
}

export interface ConversationMessage {
  id: string;
  speakerId: VoiceSpeakerId;
  speakerName: string;
  speakerRole: string;
  text: string;
  timestamp: string;
  source: 'sim' | 'ai-voice';
}

export interface ExternalSpeechEvent {
  nonce: number;
  lines: Array<{
    speakerId: VoiceSpeakerId;
    speakerName: string;
    text: string;
    durationSec?: number;
  }>;
}

interface RestaurantSimulator3DProps {
  mode: AppMode;
  selectedStaffId: StaffId;
  onSelectStaff: (staffId: StaffId) => void;
  incomingOrderEvent?: IncomingOrderSimEvent | null;
  staffCommandEvent?: StaffCommandSimEvent | null;
  externalSpeechEvent?: ExternalSpeechEvent | null;
  onConversationMessage?: (msg: ConversationMessage) => void;
  onTriggerLiveDialogue?: (scenario?: DialogueScenario) => void;
  isDialogueLoading?: boolean;
}

type CameraPresetKey = 'overview' | 'counter' | 'kitchen' | 'dining';
type AtmosphereKey = 'day' | 'rush' | 'evening';

const CAMERA_PRESETS: Record<
  CameraPresetKey,
  { label: string; pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: {
    label: 'Keseluruhan',
    pos: [12.5, 11.2, 14.5],
    target: [-0.4, 1.0, -0.5],
  },
  counter: {
    label: 'Kasir & Bar',
    pos: [2.8, 3.6, 3.2],
    target: [2.2, 1.2, -1.8],
  },
  kitchen: {
    label: 'Dapur & Gudang',
    pos: [7.6, 5.2, 0.5],
    target: [4.6, 1.1, -5.6],
  },
  dining: {
    label: 'Booth & Teras',
    pos: [-9.8, 6.8, 9.2],
    target: [-3.5, 0.8, 0.8],
  },
};

type VisitorPhase =
  | 'entering_to_cashier'
  | 'ordering_at_cashier'
  | 'walking_to_seat'
  | 'waiting_for_food'
  | 'eating'
  | 'walking_to_takeaway'
  | 'leaving';

interface SimVisitor {
  id: number;
  char: ArticulatedCharacter;
  orderType: OrderType;
  phase: VisitorPhase;
  phaseTimer: number;
  targetSeat: TableSeatSlot | null;
  foodDelivered: boolean;
  waypoints: THREE.Vector3[];
  walkCycle: number;
  speechText?: string;
  speechExpiresAt?: number;
}

interface ActiveBubbleData {
  speakerName: string;
  text: string;
  expiresAt: number;
}

interface ScheduledSimLine {
  delay: number;
  speakerId: VoiceSpeakerId;
  speakerName: string;
  speakerRole: string;
  text: string;
  duration: number;
  visitorId?: number;
  allowTts?: boolean;
}

const VISITOR_BUBBLE_SLOTS = [0, 1, 2, 3];

const VISITOR_ORDER_LINES_DINEIN = [
  "Kak, pesan Mie Hot Maks Single satu sama Te' Manis ya!",
  'Halo Kak, Mie Lioner Polos Double Goreng makan di sini satu!',
  'Kak, mau Mie Polos Single Rebus plus Telor Goreng dan Creamy Latte!',
  'Pesan Mie Hot Maks Double sama Kentang Goreng 200 gram ya Kak!',
];

const VISITOR_ORDER_LINES_TAKEAWAY = [
  'Kak, dibungkus ya: 2 Mie Hot Maks Single sama Otak-Otak Goreng!',
  'Mau Takeaway Mie Polos Double Goreng tambah Keju Parut dong Kak!',
  'Kak, bungkus Mie Polos Single plus Sosis Bakar Besar satu ya!',
];

const SINTA_KASIR_REPLIES_DINEIN = [
  'Siap Kak! Sekalian tambah Keju Leleh Rp 6.000 atau Telor Goreng biar makin mantap?',
  "Siap Kak! Untuk Hot Maks paling pas ditambah Te' Manis dingin Rp 5.000 ya!",
  'Baik Kak, pesanan langsung kami masak! Silakan pilih meja di Booth Timber atau Teras.',
];

const SINTA_KASIR_REPLIES_TAKEAWAY = [
  'Siap Kak! Dibungkus ya, ditambah biaya Packing Rp 1.000. Mau sekalian Pop Corn?',
  'Baik Kak, pesanan Takeaway segera diproses dan dikemas rapi oleh Tania!',
];

const CHEF_DIMAS_LINES = [
  'Pesanan masuk wajan! Takaran sambal Hot Maks 15 ml pas SOP!',
  'Mie Lioner Double matang merata, siap tabur Keju Parut 20 gram!',
  'Api pas! Mie Polos Goreng & Rebus langsung meluncur ke meja saji!',
];

const NADIA_BAR_LINES = [
  "Te' Manis dingin dan Creamy Latte siap! Lanjut goreng Kentang 200 gram!",
  'Otak-Otak Goreng 5 pcs & Sosis Bakar Besar matang renyah siap antar!',
  'Pop Corn Original baru matang nih, harum banget buat Cemilan Dayang!',
];

const TANIA_GUDANG_LINES = [
  'Stok Keju Parut, Jagung Popcorn, dan set kemasan Takeaway terpantau aman!',
  'Paket bungkus siap! Box rapi lengkap sesuai standar Rp 1.000 per transaksi.',
];

const RAKA_MANAGER_LINES = [
  'Kerja bagus tim! Jaga kecepatan saji dan keramahan sapaan ke setiap tamu.',
  'Kasir dan Dapur tetap sinkron ya, pastikan semua takaran sesuai SOP MieLioner!',
];

const BIMA_SERVE_LINES = [
  'Permisi Kak, MieLioner hangatnya sudah siap. Selamat menikmati!',
  'Ini pesanan MieLioner dan minumannya Kak, hati-hati masih hangat ya!',
];

const VISITOR_THANK_LINES = [
  'Wah harum banget mienya, makasih banyak ya Mas Bima!',
  'Mantap! Cepat banget jadinya, kelihatan menggugah selera.',
  'Asyik, makasih Mas! Tempatnya nyaman banget buat santai.',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface StaffPatrolState {
  waypointIndex: number;
  pauseTimer: number;
  walkCycle: number;
  isMoving: boolean;
}

type BimaState =
  | 'idle'
  | 'walking_to_kitchen'
  | 'picking_up'
  | 'walking_to_table'
  | 'returning_to_post';

// Pre-allocated scratch helpers (zero per-frame allocations)
const _vec3A = new THREE.Vector3();
const _vec3Proj = new THREE.Vector3();
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _dayBgColor = new THREE.Color(0xe2e8f0);
const _eveningBgColor = new THREE.Color(0x1e293b);
const _dayKeyColor = new THREE.Color(0xfff7ed);
const _eveningKeyColor = new THREE.Color(0xfdba74);

function animateCharacterWalk(
  char: ArticulatedCharacter,
  cycle: number,
  isMoving: boolean
) {
  if (isMoving) {
    const swing = Math.sin(cycle) * 0.58;
    char.leftLeg.rotation.x = swing;
    char.rightLeg.rotation.x = -swing;
    char.leftArm.rotation.x = -swing * 0.65;
    char.rightArm.rotation.x = swing * 0.65;
    char.bodyPivot.position.y = Math.abs(Math.sin(cycle)) * 0.045;
  } else {
    char.leftLeg.rotation.x = THREE.MathUtils.lerp(char.leftLeg.rotation.x, 0, 0.2);
    char.rightLeg.rotation.x = THREE.MathUtils.lerp(char.rightLeg.rotation.x, 0, 0.2);
    char.leftArm.rotation.x = THREE.MathUtils.lerp(char.leftArm.rotation.x, 0, 0.2);
    char.rightArm.rotation.x = THREE.MathUtils.lerp(char.rightArm.rotation.x, 0, 0.2);
    char.bodyPivot.position.y = THREE.MathUtils.lerp(char.bodyPivot.position.y, 0, 0.2);
  }
}

function setCharacterSitPose(char: ArticulatedCharacter, seated: boolean) {
  if (seated) {
    char.bodyPivot.position.y = -0.26;
    char.leftLeg.rotation.x = -Math.PI / 2.2;
    char.rightLeg.rotation.x = -Math.PI / 2.2;
    char.leftArm.rotation.x = -0.55;
    char.rightArm.rotation.x = -0.55;
  } else {
    char.bodyPivot.position.y = 0;
    char.leftLeg.rotation.x = 0;
    char.rightLeg.rotation.x = 0;
    char.leftArm.rotation.x = 0;
    char.rightArm.rotation.x = 0;
  }
}

export function RestaurantSimulator3D({
  mode: _mode,
  selectedStaffId,
  onSelectStaff,
  incomingOrderEvent,
  staffCommandEvent,
  externalSpeechEvent,
  onConversationMessage,
  onTriggerLiveDialogue,
  isDialogueLoading = false,
}: RestaurantSimulator3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const staffBubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const visitorBubbleRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const selectedStaffRef = useRef<StaffId>(selectedStaffId);
  const onSelectStaffRef = useRef(onSelectStaff);
  const onConversationRef = useRef(onConversationMessage);
  selectedStaffRef.current = selectedStaffId;
  onSelectStaffRef.current = onSelectStaff;
  onConversationRef.current = onConversationMessage;

  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const [atmosphere, setAtmosphere] = useState<AtmosphereKey>('day');
  const atmosphereRef = useRef<AtmosphereKey>('day');
  atmosphereRef.current = atmosphere;

  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);
  soundEnabledRef.current = soundEnabled;

  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPresetKey>('overview');
  const [webglError, setWebglError] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState({
    visitorsInStore: 3,
    ordersServed: 0,
    statusBanner:
      'Suasana restoran aktif · Aktifkan Suara & Voice untuk mendengar percakapan',
  });

  // Imperative bridge refs into the Three.js scene
  const spawnVisitorFnRef = useRef<
    ((orderType: OrderType, reasonLabel?: string) => void) | null
  >(null);
  const triggerCameraFnRef = useRef<((preset: CameraPresetKey) => void) | null>(
    null
  );
  const enqueueSpeechFnRef = useRef<
    ((line: ScheduledSimLine, source?: 'sim' | 'ai-voice') => void) | null
  >(null);
  const triggerStaffActionRef = useRef<Record<StaffId, number>>({
    'raka-manager': 0,
    'sinta-kasir': 0,
    'dimas-chef': 0,
    'nadia-snack-bar': 0,
    'bima-server': 0,
    'tania-inventory': 0,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(
        'Browser Anda belum mendukung WebGL2 untuk merender simulator restoran 3D.'
      );
      return;
    }

    const width = mount.clientWidth || 960;
    const height = mount.clientHeight || 560;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Konteks grafis 3D terputus sementara.');
    };
    const handleContextRestored = () => setWebglError(null);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      handleContextRestored
    );

    const scene = new THREE.Scene();
    scene.background = _dayBgColor.clone();
    scene.fog = new THREE.Fog(0xe2e8f0, 26, 62);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.2, 120);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.overview.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI / 2.15;

    let cameraTransitionActive = false;
    controls.addEventListener('start', () => {
      cameraTransitionActive = false;
    });

    triggerCameraFnRef.current = (preset: CameraPresetKey) => {
      const cfg = CAMERA_PRESETS[preset];
      _camGoalPos.set(...cfg.pos);
      _camGoalTarget.set(...cfg.target);
      cameraTransitionActive = true;
    };

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x78350f, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.65);
    keyLight.position.set(14, 22, 14);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    const d = 16;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 0.55);
    rimLight.position.set(-14, 12, -16);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const layout: RestaurantSceneLayout = buildMieLionerScene(scene, maxAniso);
    const shadowTex = createContactShadowTexture();

    const staffChars: Record<StaffId, ArticulatedCharacter> = {
      'raka-manager': buildArticulatedCharacter(
        getStaffStyleConfig('raka-manager'),
        shadowTex
      ),
      'sinta-kasir': buildArticulatedCharacter(
        getStaffStyleConfig('sinta-kasir'),
        shadowTex
      ),
      'dimas-chef': buildArticulatedCharacter(
        getStaffStyleConfig('dimas-chef'),
        shadowTex
      ),
      'nadia-snack-bar': buildArticulatedCharacter(
        getStaffStyleConfig('nadia-snack-bar'),
        shadowTex
      ),
      'bima-server': buildArticulatedCharacter(
        getStaffStyleConfig('bima-server'),
        shadowTex
      ),
      'tania-inventory': buildArticulatedCharacter(
        getStaffStyleConfig('tania-inventory'),
        shadowTex
      ),
    };

    const staffPatrolStates: Record<StaffId, StaffPatrolState> = {
      'raka-manager': { waypointIndex: 0, pauseTimer: 1.5, walkCycle: 0, isMoving: false },
      'sinta-kasir': { waypointIndex: 0, pauseTimer: 2.2, walkCycle: 0, isMoving: false },
      'dimas-chef': { waypointIndex: 0, pauseTimer: 2.8, walkCycle: 0, isMoving: false },
      'nadia-snack-bar': { waypointIndex: 0, pauseTimer: 2.4, walkCycle: 0, isMoving: false },
      'bima-server': { waypointIndex: 0, pauseTimer: 2.0, walkCycle: 0, isMoving: false },
      'tania-inventory': { waypointIndex: 0, pauseTimer: 2.6, walkCycle: 0, isMoving: false },
    };

    const staffClickableMeshes: THREE.Object3D[] = [];
    (Object.keys(staffChars) as StaffId[]).forEach((id) => {
      const char = staffChars[id];
      const station = layout.staffStations[id];
      char.root.position.copy(station.pos);
      char.root.rotation.y = station.rotY;
      scene.add(char.root);
      staffClickableMeshes.push(char.root);
    });

    const visitors: SimVisitor[] = [];
    const deliveryQueue: SimVisitor[] = [];
    let visitorIdCounter = 1;
    let servedCount = 0;

    let bimaState: BimaState = 'idle';
    let bimaTargetVisitor: SimVisitor | null = null;
    let bimaWalkCycle = 0;
    let bimaPauseTimer = 0;

    // Live speech bubble & conversation state inside 3D simulator
    const staffSpeechBubbles: Record<StaffId, ActiveBubbleData | null> = {
      'raka-manager': null,
      'sinta-kasir': null,
      'dimas-chef': null,
      'nadia-snack-bar': null,
      'bima-server': null,
      'tania-inventory': null,
    };
    const scheduledLines: Array<ScheduledSimLine & { source: 'sim' | 'ai-voice' }> = [];
    let lastAutoTtsAt = 0;
    let simElapsedRef = 0;
    let ambientChatterCooldown = 6;
    let ambientStaffCycleIdx = 0;

    const activateSpeechLine = (
      line: ScheduledSimLine,
      source: 'sim' | 'ai-voice' = 'sim'
    ) => {
      const nowSec = simElapsedRef;
      const expiresAt = nowSec + line.duration;

      if (line.speakerId in staffSpeechBubbles) {
        const sid = line.speakerId as StaffId;
        staffSpeechBubbles[sid] = {
          speakerName: line.speakerName,
          text: line.text,
          expiresAt,
        };
        triggerStaffActionRef.current[sid] = Math.max(
          triggerStaffActionRef.current[sid],
          Math.min(3.5, line.duration)
        );
      } else if (line.visitorId !== undefined) {
        const targetVisitor = visitors.find((v) => v.id === line.visitorId);
        if (targetVisitor) {
          targetVisitor.speechText = line.text;
          targetVisitor.speechExpiresAt = expiresAt;
        }
      } else if (visitors.length > 0) {
        // Pick an active non-leaving visitor to show visitor AI speech bubble
        const activeVisitor =
          visitors.find(
            (v) =>
              v.phase === 'ordering_at_cashier' ||
              v.phase === 'eating' ||
              v.phase === 'waiting_for_food'
          ) || visitors[0];
        if (activeVisitor) {
          activeVisitor.speechText = line.text;
          activeVisitor.speechExpiresAt = expiresAt;
        }
      }

      if (source === 'sim') {
        onConversationRef.current?.({
          id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speakerId: line.speakerId,
          speakerName: line.speakerName,
          speakerRole: line.speakerRole,
          text: line.text,
          timestamp: new Date().toISOString(),
          source: 'sim',
        });

        // Subtle automatic Gemini voice narration for selected live events when sound is turned on
        const nowMs = Date.now();
        if (
          line.allowTts &&
          soundEnabledRef.current &&
          !voicePlayer.isPlaying() &&
          nowMs - lastAutoTtsAt > 13000
        ) {
          lastAutoTtsAt = nowMs;
          void fetchSingleSpeakerTts({
            text: line.text,
            speakerId: line.speakerId,
          })
            .then((res) => {
              if (soundEnabledRef.current && !voicePlayer.isPlaying()) {
                voicePlayer.enqueueWav(res.audioBase64);
              }
            })
            .catch(() => {
              // Ignore background auto-TTS hiccup silently
            });
        }
      }
    };

    enqueueSpeechFnRef.current = (line, source = 'sim') => {
      if (line.delay <= 0.05) {
        activateSpeechLine(line, source);
      } else {
        scheduledLines.push({ ...line, source });
      }
    };

    const findFreeSeat = (): TableSeatSlot | null => {
      const free = layout.seatSlots.filter((s) => !s.occupied);
      if (free.length === 0) return null;
      return free[Math.floor(Math.random() * free.length)];
    };

    const spawnVisitor = (orderType: OrderType, reasonLabel?: string) => {
      if (visitors.length >= 9) return;
      const char = buildArticulatedCharacter(
        getVisitorStyleConfig(visitorIdCounter),
        shadowTex
      );
      char.root.position.copy(layout.entrancePos);
      char.root.position.x += ((visitorIdCounter % 3) - 1) * 0.45;
      scene.add(char.root);

      const queueOffset = new THREE.Vector3(
        layout.cashierQueuePos.x + ((visitorIdCounter % 3) - 1) * 0.35,
        layout.cashierQueuePos.y,
        layout.cashierQueuePos.z + Math.min(visitors.length * 0.3, 1.1)
      );

      const visitor: SimVisitor = {
        id: visitorIdCounter++,
        char,
        orderType,
        phase: 'entering_to_cashier',
        phaseTimer: 0,
        targetSeat: null,
        foodDelivered: false,
        waypoints: [new THREE.Vector3(0.5, 0.04, 3.6), queueOffset],
        walkCycle: 0,
      };
      visitors.push(visitor);

      restaurantSound.playDoorChime();
      triggerStaffActionRef.current['sinta-kasir'] = 3.5;
      setLiveStats((prev) => ({
        ...prev,
        visitorsInStore: visitors.length,
        statusBanner:
          reasonLabel ||
          `Pengunjung baru masuk kedai (${
            orderType === 'takeaway' ? 'Takeaway / Bungkus' : 'Makan di Tempat'
          })`,
      }));
    };

    spawnVisitorFnRef.current = spawnVisitor;

    const seedInitialGuests = () => {
      const seat1 = layout.seatSlots[0];
      const seat2 = layout.seatSlots[4];
      [seat1, seat2].forEach((seat, idx) => {
        if (!seat) return;
        seat.occupied = true;
        seat.bowlMesh.visible = true;
        const char = buildArticulatedCharacter(
          getVisitorStyleConfig(idx + 1),
          shadowTex
        );
        char.root.position.copy(seat.seatPos);
        char.root.rotation.y = seat.seatRotationY;
        setCharacterSitPose(char, true);
        scene.add(char.root);
        visitors.push({
          id: visitorIdCounter++,
          char,
          orderType: 'dine-in',
          phase: 'eating',
          phaseTimer: 8 + idx * 5,
          targetSeat: seat,
          foodDelivered: true,
          waypoints: [],
          walkCycle: 0,
        });
      });

      spawnVisitor('dine-in', 'Pengunjung baru menuju Meja Kasir Sinta Maharani');
    };
    seedInitialGuests();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownXY = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownXY = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownXY.x;
      const dy = e.clientY - pointerDownXY.y;
      if (dx * dx + dy * dy > 36) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(staffClickableMeshes, true);
      if (hits.length > 0) {
        const hitStaffId = hits[0].object.userData.staffId as StaffId | undefined;
        if (hitStaffId) {
          onSelectStaffRef.current(hitStaffId);
          triggerStaffActionRef.current[hitStaffId] = 2.5;
          restaurantSound.playStaffAck();
          const profile = AI_STAFF_PROFILES.find((p) => p.id === hitStaffId);
          if (profile) {
            setLiveStats((prev) => ({
              ...prev,
              statusBanner: `Terpilih: ${profile.name} (${profile.shortTitle})`,
            }));
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const moveTowards = (
      char: ArticulatedCharacter,
      target: THREE.Vector3,
      speed: number,
      dt: number
    ): boolean => {
      _vec3A.subVectors(target, char.root.position);
      _vec3A.y = 0;
      const dist = _vec3A.length();
      if (dist < 0.14) {
        char.root.position.x = target.x;
        char.root.position.z = target.z;
        return true;
      }
      _vec3A.normalize();
      const step = Math.min(dist, speed * dt);
      char.root.position.x += _vec3A.x * step;
      char.root.position.z += _vec3A.z * step;
      char.root.rotation.y = Math.atan2(_vec3A.x, _vec3A.z);
      return false;
    };

    // Project 3D staff & visitor coordinates onto DOM floating Nameplates & Speech Bubbles
    const updateProjectedNameplates = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w <= 0 || h <= 0) return;

      (Object.keys(staffChars) as StaffId[]).forEach((id) => {
        const el = labelRefs.current[id];
        const bubbleEl = staffBubbleRefs.current[id];
        const char = staffChars[id];
        _vec3Proj.copy(char.root.position);
        _vec3Proj.y += 2.15;
        _vec3Proj.project(camera);

        const outOfView =
          _vec3Proj.z < -1 || _vec3Proj.z > 1;
        const screenX = ((_vec3Proj.x + 1) / 2) * w;
        const screenY = ((-_vec3Proj.y + 1) / 2) * h;
        const clipped =
          outOfView ||
          screenX < 20 ||
          screenX > w - 20 ||
          screenY < 20 ||
          screenY > h - 20;

        if (el) {
          if (clipped) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
          } else {
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
            el.style.transform = `translate3d(${screenX.toFixed(1)}px, ${screenY.toFixed(
              1
            )}px, 0) translate(-50%, -100%)`;
          }
        }

        if (bubbleEl) {
          const activeBubble = staffSpeechBubbles[id];
          if (
            !clipped &&
            activeBubble &&
            simElapsedRef <= activeBubble.expiresAt
          ) {
            const textSpan = bubbleEl.querySelector('[data-bubble-text]');
            if (textSpan && textSpan.textContent !== activeBubble.text) {
              textSpan.textContent = activeBubble.text;
            }
            bubbleEl.style.opacity = '1';
            bubbleEl.style.transform = `translate3d(${screenX.toFixed(
              1
            )}px, ${screenY.toFixed(1)}px, 0) translate(-50%, calc(-100% - 44px))`;
          } else {
            if (activeBubble && simElapsedRef > activeBubble.expiresAt) {
              staffSpeechBubbles[id] = null;
            }
            bubbleEl.style.opacity = '0';
          }
        }
      });

      // Project up to 4 active speaking visitors
      const speakingVisitors = visitors
        .filter(
          (v) =>
            v.speechText &&
            v.speechExpiresAt !== undefined &&
            simElapsedRef <= v.speechExpiresAt
        )
        .slice(0, VISITOR_BUBBLE_SLOTS.length);

      VISITOR_BUBBLE_SLOTS.forEach((slotIdx) => {
        const vBubble = visitorBubbleRefs.current[slotIdx];
        if (!vBubble) return;
        const v = speakingVisitors[slotIdx];
        if (!v || !v.speechText) {
          vBubble.style.opacity = '0';
          return;
        }
        _vec3Proj.copy(v.char.root.position);
        _vec3Proj.y += 2.15;
        _vec3Proj.project(camera);

        if (_vec3Proj.z < -1 || _vec3Proj.z > 1) {
          vBubble.style.opacity = '0';
          return;
        }
        const screenX = ((_vec3Proj.x + 1) / 2) * w;
        const screenY = ((-_vec3Proj.y + 1) / 2) * h;
        if (screenX < 24 || screenX > w - 24 || screenY < 24 || screenY > h - 24) {
          vBubble.style.opacity = '0';
          return;
        }

        const nameSpan = vBubble.querySelector('[data-visitor-name]');
        const textSpan = vBubble.querySelector('[data-visitor-text]');
        if (nameSpan) nameSpan.textContent = `Pengunjung #${v.id}`;
        if (textSpan && textSpan.textContent !== v.speechText) {
          textSpan.textContent = v.speechText;
        }
        vBubble.style.opacity = '1';
        vBubble.style.transform = `translate3d(${screenX.toFixed(
          1
        )}px, ${screenY.toFixed(1)}px, 0) translate(-50%, -100%)`;
      });
    };

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let ambientSpawnCooldown = 12;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function updateAtmosphereLighting(dt: number) {
      const isEvening = atmosphereRef.current === 'evening';
      const bg = scene.background as THREE.Color;
      const targetBg = isEvening ? _eveningBgColor : _dayBgColor;
      bg.lerp(targetBg, Math.min(1, dt * 3));
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.copy(bg);
      }

      keyLight.intensity = THREE.MathUtils.damp(
        keyLight.intensity,
        isEvening ? 0.65 : 1.65,
        3,
        dt
      );
      keyLight.color.lerp(
        isEvening ? _eveningKeyColor : _dayKeyColor,
        Math.min(1, dt * 3)
      );
      hemiLight.intensity = THREE.MathUtils.damp(
        hemiLight.intensity,
        isEvening ? 0.35 : 0.72,
        3,
        dt
      );
      layout.warmLights.forEach((ptLight) => {
        ptLight.intensity = THREE.MathUtils.damp(
          ptLight.intensity,
          isEvening ? 5.2 : 2.0,
          3,
          dt
        );
      });
      layout.lampBulbMats.forEach((mat) => {
        mat.emissiveIntensity = THREE.MathUtils.damp(
          mat.emissiveIntensity,
          isEvening ? 1.6 : 0.7,
          3,
          dt
        );
      });
    }

    function updateSimulation(dt: number, elapsed: number) {
      updateAtmosphereLighting(dt);

      if (cameraTransitionActive) {
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          _camGoalPos.x,
          4.5,
          dt
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          _camGoalPos.y,
          4.5,
          dt
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          _camGoalPos.z,
          4.5,
          dt
        );
        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          _camGoalTarget.x,
          4.5,
          dt
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          _camGoalTarget.y,
          4.5,
          dt
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          _camGoalTarget.z,
          4.5,
          dt
        );
        if (camera.position.distanceTo(_camGoalPos) < 0.08) {
          cameraTransitionActive = false;
        }
      }

      if (isPausedRef.current) return;

      const simSpeed = atmosphereRef.current === 'rush' ? 1.4 : 1.0;
      const simDt = dt * simSpeed;
      simElapsedRef = elapsed;

      // Process delayed conversation queue
      for (let q = scheduledLines.length - 1; q >= 0; q--) {
        scheduledLines[q].delay -= dt;
        if (scheduledLines[q].delay <= 0) {
          const ready = scheduledLines.splice(q, 1)[0];
          activateSpeechLine(ready, ready.source);
        }
      }

      // Periodic ambient staff & diner chatter so all 6 employees feel alive
      ambientChatterCooldown -= simDt;
      if (ambientChatterCooldown <= 0) {
        ambientChatterCooldown = atmosphereRef.current === 'rush' ? 6.5 : 9.5;
        const cycle = ambientStaffCycleIdx % 4;
        ambientStaffCycleIdx += 1;

        if (cycle === 0) {
          activateSpeechLine({
            delay: 0,
            speakerId: 'raka-manager',
            speakerName: 'Raka Pratama',
            speakerRole: 'Kepala Restoran',
            text: pickRandom(RAKA_MANAGER_LINES),
            duration: 4.5,
            allowTts: true,
          });
        } else if (cycle === 1) {
          activateSpeechLine({
            delay: 0,
            speakerId: 'nadia-snack-bar',
            speakerName: 'Nadia Putri',
            speakerRole: 'Bar & Cemilan Dayang',
            text: pickRandom(NADIA_BAR_LINES),
            duration: 4.5,
            allowTts: true,
          });
        } else if (cycle === 2) {
          activateSpeechLine({
            delay: 0,
            speakerId: 'tania-inventory',
            speakerName: 'Tania Lestari',
            speakerRole: 'Gudang, Stok & Packing',
            text: pickRandom(TANIA_GUDANG_LINES),
            duration: 4.5,
            allowTts: true,
          });
        } else {
          activateSpeechLine({
            delay: 0,
            speakerId: 'dimas-chef',
            speakerName: 'Chef Dimas Wijaya',
            speakerRole: 'Koki Mie & Hot Maks',
            text: pickRandom(CHEF_DIMAS_LINES),
            duration: 4.5,
            allowTts: true,
          });
        }
      }

      // Kitchen exhaust fan & steam animation
      layout.exhaustFan.rotation.y += simDt * 6.5;
      layout.fryingPotSteams.forEach((steam, i) => {
        const wave = (elapsed * 1.2 + i * 0.5) % 1;
        steam.position.y = 1.25 + wave * 0.7;
        steam.scale.setScalar(0.8 + wave * 0.75);
      });

      // Ambient customer arrival
      ambientSpawnCooldown -= simDt;
      if (ambientSpawnCooldown <= 0) {
        const targetCap = atmosphereRef.current === 'rush' ? 7 : 4;
        ambientSpawnCooldown = atmosphereRef.current === 'rush' ? 8 : 14;
        if (visitors.length < targetCap) {
          spawnVisitor(
            Math.random() < 0.28 ? 'takeaway' : 'dine-in',
            'Pelanggan baru datang memesan MieLioner'
          );
        }
      }

      // Update ALL 6 Staff AI Employees with authentic patrol & jobdesk animations
      (Object.keys(staffChars) as StaffId[]).forEach((id) => {
        const char = staffChars[id];
        const pState = staffPatrolStates[id];
        const waypoints = layout.staffPatrols[id];

        if (char.selectionRing) {
          const mat = char.selectionRing.material as THREE.MeshBasicMaterial;
          mat.opacity = selectedStaffRef.current === id ? 0.92 : 0.0;
        }
        if (triggerStaffActionRef.current[id] > 0) {
          triggerStaffActionRef.current[id] = Math.max(
            0,
            triggerStaffActionRef.current[id] - dt
          );
        }

        // Bima has dedicated delivery state machine when serving orders
        if (id === 'bima-server' && bimaState !== 'idle') {
          return;
        }

        // Sinta pauses at POS whenever a visitor is ordering
        const visitorOrdering = visitors.some(
          (v) => v.phase === 'ordering_at_cashier'
        );
        if (id === 'sinta-kasir' && visitorOrdering) {
          animateCharacterWalk(char, 0, false);
          moveTowards(char, layout.staffStations['sinta-kasir'].pos, 2.2, simDt);
          char.root.rotation.y = 0;
          char.rightArm.rotation.x = -0.7 + Math.sin(elapsed * 8) * 0.25;
          char.headGroup.rotation.y = Math.sin(elapsed * 2) * 0.15;
          return;
        }

        if (pState.pauseTimer > 0) {
          pState.pauseTimer -= simDt;
          pState.isMoving = false;
          animateCharacterWalk(char, 0, false);

          const activeMult = triggerStaffActionRef.current[id] > 0 ? 7.5 : 3.0;
          if (id === 'dimas-chef') {
            char.root.rotation.y = Math.PI;
            char.rightArm.rotation.x = -0.85 + Math.sin(elapsed * activeMult) * 0.35;
            char.leftArm.rotation.x = -0.5 + Math.cos(elapsed * 2.5) * 0.15;
          } else if (id === 'nadia-snack-bar') {
            char.root.rotation.y = 0;
            char.rightArm.rotation.x = -0.75 + Math.sin(elapsed * activeMult) * 0.28;
            char.leftArm.rotation.x = -0.6 + Math.cos(elapsed * activeMult) * 0.22;
          } else if (id === 'tania-inventory') {
            char.root.rotation.y = Math.PI;
            char.leftArm.rotation.x = -0.55 + Math.sin(elapsed * activeMult) * 0.22;
          } else if (id === 'raka-manager') {
            char.root.rotation.y = 0;
            char.headGroup.rotation.y = Math.sin(elapsed * 1.1) * 0.35;
          } else if (id === 'sinta-kasir') {
            char.root.rotation.y = 0;
            char.headGroup.rotation.y = Math.sin(elapsed * 1.2) * 0.22;
          } else if (id === 'bima-server') {
            char.headGroup.rotation.y = Math.sin(elapsed * 1.3) * 0.25;
          }
        } else {
          const targetWp = waypoints[pState.waypointIndex];
          pState.isMoving = true;
          pState.walkCycle += simDt * 6.5;
          animateCharacterWalk(char, pState.walkCycle, true);
          const arrived = moveTowards(char, targetWp, 1.55, simDt);
          if (arrived) {
            pState.waypointIndex = (pState.waypointIndex + 1) % waypoints.length;
            pState.pauseTimer = 2.2 + Math.random() * 2.4;
            if (id === 'dimas-chef' && Math.random() < 0.45) {
              restaurantSound.playKitchenSizzle();
            }
          }
        }
      });

      // Update Visitors State Machine
      for (let i = visitors.length - 1; i >= 0; i--) {
        const v = visitors[i];

        if (v.phase === 'entering_to_cashier') {
          const wp = v.waypoints[0];
          if (wp) {
            v.walkCycle += simDt * 7.5;
            animateCharacterWalk(v.char, v.walkCycle, true);
            const arrived = moveTowards(v.char, wp, 2.35, simDt);
            if (arrived) v.waypoints.shift();
          } else {
            animateCharacterWalk(v.char, 0, false);
            v.char.root.rotation.y = Math.PI;
            v.phase = 'ordering_at_cashier';
            v.phaseTimer = 2.8;
            triggerStaffActionRef.current['sinta-kasir'] = 2.8;
            restaurantSound.playCashierBeep();

            // Visitor greets Sinta and orders, Sinta responds warmly
            const orderLine =
              v.orderType === 'takeaway'
                ? pickRandom(VISITOR_ORDER_LINES_TAKEAWAY)
                : pickRandom(VISITOR_ORDER_LINES_DINEIN);
            const kasirReply =
              v.orderType === 'takeaway'
                ? pickRandom(SINTA_KASIR_REPLIES_TAKEAWAY)
                : pickRandom(SINTA_KASIR_REPLIES_DINEIN);

            activateSpeechLine({
              delay: 0,
              speakerId: v.id % 2 === 0 ? 'visitor-female' : 'visitor-male',
              speakerName: `Pengunjung #${v.id}`,
              speakerRole: 'Pelanggan MieLioner',
              text: orderLine,
              duration: 3.8,
              visitorId: v.id,
              allowTts: true,
            });
            scheduledLines.push({
              delay: 1.35,
              speakerId: 'sinta-kasir',
              speakerName: 'Sinta Maharani',
              speakerRole: 'Kasir & Frontliner',
              text: kasirReply,
              duration: 4.0,
              allowTts: true,
              source: 'sim',
            });
          }
        } else if (v.phase === 'ordering_at_cashier') {
          v.phaseTimer -= simDt;
          v.char.rightArm.rotation.x = -0.45 + Math.sin(elapsed * 5) * 0.15;
          if (v.phaseTimer <= 0) {
            v.char.rightArm.rotation.x = 0;
            if (v.orderType === 'takeaway') {
              triggerStaffActionRef.current['tania-inventory'] = 2.8;
              triggerStaffActionRef.current['dimas-chef'] = 2.8;
              restaurantSound.playKitchenSizzle();
              scheduledLines.push({
                delay: 0.4,
                speakerId: 'tania-inventory',
                speakerName: 'Tania Lestari',
                speakerRole: 'Gudang, Stok & Packing',
                text: 'Pesanan Takeaway siap dikemas! Box dan alat makan lengkap ya.',
                duration: 4.0,
                source: 'sim',
              });
              v.phase = 'walking_to_takeaway';
              v.phaseTimer = 2.4;
            } else {
              const freeSeat = findFreeSeat();
              if (freeSeat) {
                freeSeat.occupied = true;
                v.targetSeat = freeSeat;
                triggerStaffActionRef.current['dimas-chef'] = 4.0;
                triggerStaffActionRef.current['nadia-snack-bar'] = 3.0;
                restaurantSound.playKitchenSizzle();
                scheduledLines.push({
                  delay: 0.6,
                  speakerId: 'dimas-chef',
                  speakerName: 'Chef Dimas Wijaya',
                  speakerRole: 'Koki Mie & Hot Maks',
                  text: pickRandom(CHEF_DIMAS_LINES),
                  duration: 4.0,
                  source: 'sim',
                });
                v.waypoints = [
                  new THREE.Vector3(-1.2, 0.04, 1.8),
                  freeSeat.serveStopPos.clone(),
                  freeSeat.seatPos.clone(),
                ];
                v.phase = 'walking_to_seat';
              } else {
                v.orderType = 'takeaway';
                v.phase = 'walking_to_takeaway';
                v.phaseTimer = 2.2;
              }
            }
          }
        } else if (v.phase === 'walking_to_takeaway') {
          const arrived = moveTowards(
            v.char,
            layout.takeawayPickupPos,
            2.1,
            simDt
          );
          if (!arrived) {
            v.walkCycle += simDt * 7;
            animateCharacterWalk(v.char, v.walkCycle, true);
          } else {
            animateCharacterWalk(v.char, 0, false);
            v.char.root.rotation.y = Math.PI;
            v.phaseTimer -= simDt;
            if (v.phaseTimer <= 0) {
              if (v.char.propTakeaway) v.char.propTakeaway.visible = true;
              servedCount += 1;
              restaurantSound.playServeBell();
              v.waypoints = [
                new THREE.Vector3(0.6, 0.04, 3.8),
                layout.entrancePos.clone(),
              ];
              v.phase = 'leaving';
              setLiveStats((prev) => ({
                ...prev,
                ordersServed: servedCount,
                statusBanner:
                  'Takeaway selesai dikemas Tania (+Packing Rp 1.000)',
              }));
            }
          }
        } else if (v.phase === 'walking_to_seat') {
          const wp = v.waypoints[0];
          if (wp) {
            v.walkCycle += simDt * 7.5;
            animateCharacterWalk(v.char, v.walkCycle, true);
            const arrived = moveTowards(v.char, wp, 2.35, simDt);
            if (arrived) v.waypoints.shift();
          } else if (v.targetSeat) {
            animateCharacterWalk(v.char, 0, false);
            v.char.root.rotation.y = v.targetSeat.seatRotationY;
            setCharacterSitPose(v.char, true);
            v.phase = 'waiting_for_food';
            deliveryQueue.push(v);
          }
        } else if (v.phase === 'waiting_for_food') {
          v.char.headGroup.rotation.y = Math.sin(elapsed * 1.4 + v.id) * 0.25;
        } else if (v.phase === 'eating') {
          v.phaseTimer -= simDt;
          v.char.rightArm.rotation.x =
            -0.8 + Math.sin(elapsed * 4.5 + v.id) * 0.22;
          if (v.phaseTimer <= 0) {
            setCharacterSitPose(v.char, false);
            if (v.targetSeat) {
              v.targetSeat.bowlMesh.visible = false;
              v.targetSeat.occupied = false;
            }
            v.waypoints = [
              v.targetSeat
                ? v.targetSeat.serveStopPos.clone()
                : new THREE.Vector3(0, 0.04, 2.5),
              new THREE.Vector3(0.5, 0.04, 3.8),
              layout.entrancePos.clone(),
            ];
            v.phase = 'leaving';
          }
        } else if (v.phase === 'leaving') {
          const wp = v.waypoints[0];
          if (wp) {
            v.walkCycle += simDt * 7.5;
            animateCharacterWalk(v.char, v.walkCycle, true);
            const arrived = moveTowards(v.char, wp, 2.4, simDt);
            if (arrived) v.waypoints.shift();
          } else {
            scene.remove(v.char.root);
            visitors.splice(i, 1);
            setLiveStats((prev) => ({
              ...prev,
              visitorsInStore: visitors.length,
            }));
          }
        }
      }

      // Bima Delivery Workflow
      const bima = staffChars['bima-server'];
      if (bimaState === 'idle') {
        if (deliveryQueue.length > 0) {
          bimaTargetVisitor = deliveryQueue.shift() || null;
          if (bimaTargetVisitor && bimaTargetVisitor.targetSeat) {
            bimaState = 'walking_to_kitchen';
            triggerStaffActionRef.current['bima-server'] = 4.0;
          }
        }
      } else if (bimaState === 'walking_to_kitchen') {
        bimaWalkCycle += simDt * 8;
        animateCharacterWalk(bima, bimaWalkCycle, true);
        if (moveTowards(bima, layout.kitchenPickupPos, 2.6, simDt)) {
          bimaState = 'picking_up';
          bimaPauseTimer = 0.7;
          restaurantSound.playServeBell();
        }
      } else if (bimaState === 'picking_up') {
        animateCharacterWalk(bima, 0, false);
        bimaPauseTimer -= simDt;
        if (bimaPauseTimer <= 0) {
          if (bima.propBowl) bima.propBowl.visible = true;
          bimaState = 'walking_to_table';
        }
      } else if (bimaState === 'walking_to_table') {
        if (!bimaTargetVisitor || !bimaTargetVisitor.targetSeat) {
          if (bima.propBowl) bima.propBowl.visible = false;
          bimaState = 'returning_to_post';
        } else {
          bimaWalkCycle += simDt * 8;
          animateCharacterWalk(bima, bimaWalkCycle, true);
          if (
            moveTowards(
              bima,
              bimaTargetVisitor.targetSeat.serveStopPos,
              2.55,
              simDt
            )
          ) {
            if (bima.propBowl) bima.propBowl.visible = false;
            bimaTargetVisitor.targetSeat.bowlMesh.visible = true;
            bimaTargetVisitor.foodDelivered = true;
            bimaTargetVisitor.phase = 'eating';
            bimaTargetVisitor.phaseTimer = 11;
            servedCount += 1;
            restaurantSound.playServeBell();

            const servedVisitor = bimaTargetVisitor;
            activateSpeechLine({
              delay: 0,
              speakerId: 'bima-server',
              speakerName: 'Bima Kusuma',
              speakerRole: 'Pramusaji Area Makan',
              text: pickRandom(BIMA_SERVE_LINES),
              duration: 3.8,
              allowTts: true,
            });
            scheduledLines.push({
              delay: 1.4,
              speakerId: servedVisitor.id % 2 === 0 ? 'visitor-female' : 'visitor-male',
              speakerName: `Pengunjung #${servedVisitor.id}`,
              speakerRole: 'Pelanggan MieLioner',
              text: pickRandom(VISITOR_THANK_LINES),
              duration: 3.8,
              visitorId: servedVisitor.id,
              allowTts: true,
              source: 'sim',
            });

            setLiveStats((prev) => ({
              ...prev,
              ordersServed: servedCount,
              statusBanner: `Bima mengantar MieLioner ke ${bimaTargetVisitor?.targetSeat?.zoneName}`,
            }));
            bimaTargetVisitor = null;
            bimaState = 'returning_to_post';
          }
        }
      } else if (bimaState === 'returning_to_post') {
        bimaWalkCycle += simDt * 7.5;
        animateCharacterWalk(bima, bimaWalkCycle, true);
        if (
          moveTowards(bima, layout.staffStations['bima-server'].pos, 2.4, simDt)
        ) {
          animateCharacterWalk(bima, 0, false);
          bima.root.rotation.y = layout.staffStations['bima-server'].rotY;
          bimaState = 'idle';
        }
      }
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      updateSimulation(dt, elapsed);
      controls.update();
      renderer.render(scene, camera);
      updateProjectedNameplates();

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        handleContextLost
      );
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        handleContextRestored
      );
      controls.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      restaurantSound.setEnabled(false);
      voicePlayer.setVoiceEnabled(false);
    };
  }, []);

  useEffect(() => {
    if (!incomingOrderEvent || !spawnVisitorFnRef.current) return;
    spawnVisitorFnRef.current(
      incomingOrderEvent.orderType,
      `Pesanan baru ${incomingOrderEvent.label}: pengunjung 3D menuju kasir`
    );
  }, [incomingOrderEvent?.nonce]);

  useEffect(() => {
    if (!staffCommandEvent) return;
    restaurantSound.playStaffAck();
    if (staffCommandEvent.staffId === 'all-team') {
      (Object.keys(triggerStaffActionRef.current) as StaffId[]).forEach((id) => {
        triggerStaffActionRef.current[id] = 4.5;
      });
    } else {
      triggerStaffActionRef.current[staffCommandEvent.staffId] = 4.5;
    }
  }, [staffCommandEvent?.nonce]);

  useEffect(() => {
    if (!externalSpeechEvent || !enqueueSpeechFnRef.current) return;
    let accumDelay = 0;
    externalSpeechEvent.lines.forEach((line) => {
      const dur = line.durationSec ?? 3.6;
      enqueueSpeechFnRef.current?.(
        {
          delay: accumDelay,
          speakerId: line.speakerId,
          speakerName: line.speakerName,
          speakerRole: 'Dialog Suara AI',
          text: line.text,
          duration: dur,
        },
        'ai-voice'
      );
      accumDelay += Math.max(2.4, dur - 0.3);
    });
  }, [externalSpeechEvent?.nonce]);

  const handleSelectCameraPreset = (preset: CameraPresetKey) => {
    setActivePreset(preset);
    triggerCameraFnRef.current?.(preset);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    const result = restaurantSound.setEnabled(next);
    voicePlayer.setVoiceEnabled(result);
    setSoundEnabled(result);
  };

  const handleAtmosphereChange = (next: AtmosphereKey) => {
    setAtmosphere(next);
    if (next === 'rush') {
      spawnVisitorFnRef.current?.('dine-in', 'Jam makan siang ramai — pengunjung berdatangan!');
      spawnVisitorFnRef.current?.('takeaway');
    }
  };

  if (webglError) {
    return (
      <div className="relative h-[460px] rounded-xl overflow-hidden border border-stone-200 bg-stone-100 flex flex-col items-center justify-center p-8 text-center">
        <img
          src="/assets/aistudio/image_2a505b7f.png"
          alt="Pratinjau ruang kedai MieLioner"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <p className="relative font-display font-bold text-zinc-900 text-lg">
          Pratinjau Restoran MieLioner
        </p>
        <p className="relative text-sm text-zinc-700 mt-1 max-w-md">
          {webglError}
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[540px] sm:h-[620px] rounded-xl overflow-hidden border border-stone-200 bg-slate-200">
      {/* Isolated WebGL Mount Container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* 3D-Projected Floating Nameplates & Live Speech Bubbles for All Staff + Visitors */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {AI_STAFF_PROFILES.map((staff) => {
          const isSelected = staff.id === selectedStaffId;
          return (
            <div key={staff.id}>
              {/* Staff Speech Bubble */}
              <div
                ref={(el) => {
                  staffBubbleRefs.current[staff.id] = el;
                }}
                style={{ opacity: 0 }}
                className="absolute top-0 left-0 max-w-[210px] px-2.5 py-1.5 rounded-xl bg-white text-zinc-900 border border-stone-300 shadow-md text-[11px] leading-snug font-medium pointer-events-none z-30"
              >
                <span data-bubble-text className="block" />
              </div>

              {/* Staff Name & Job Title Plate */}
              <button
                ref={(el) => {
                  labelRefs.current[staff.id] = el;
                }}
                type="button"
                onClick={() => {
                  onSelectStaff(staff.id);
                  triggerStaffActionRef.current[staff.id] = 2.5;
                  restaurantSound.playStaffAck();
                }}
                style={{ opacity: 0 }}
                className={`absolute top-0 left-0 px-2.5 py-1 rounded-lg border text-left transition-colors duration-150 shadow-sm whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-orange-600 text-white border-orange-400 z-20'
                    : 'bg-zinc-900/90 text-white border-white/15 hover:bg-zinc-800'
                }`}
              >
                <span className="block text-[11px] font-bold leading-tight">
                  {staff.name}
                </span>
                <span
                  className={`block text-[10px] leading-tight ${
                    isSelected ? 'text-orange-100' : 'text-stone-300'
                  }`}
                >
                  {staff.shortTitle}
                </span>
              </button>
            </div>
          );
        })}

        {/* Visitor Speech Bubble Pool */}
        {VISITOR_BUBBLE_SLOTS.map((slotIdx) => (
          <div
            key={`visitor-bubble-${slotIdx}`}
            ref={(el) => {
              visitorBubbleRefs.current[slotIdx] = el;
            }}
            style={{ opacity: 0 }}
            className="absolute top-0 left-0 max-w-[205px] px-2.5 py-1.5 rounded-xl bg-amber-50 text-zinc-900 border border-amber-300 shadow-md text-[11px] leading-snug pointer-events-none z-25"
          >
            <span
              data-visitor-name
              className="block text-[10px] font-bold text-amber-800 leading-tight"
            />
            <span data-visitor-text className="block font-medium mt-0.5" />
          </div>
        ))}
      </div>

      {/* Top-Left Live Status Overlay (solid dark rgba, zero backdrop-filter) */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 flex flex-wrap items-start justify-between gap-2 z-10">
        <div className="bg-zinc-900/90 text-white px-3.5 py-2 rounded-xl border border-white/10 max-w-md">
          <p className="text-xs font-semibold text-orange-400">
            Simulator Restoran 3D MieLioner
          </p>
          <p className="text-xs text-stone-100 mt-0.5">
            {liveStats.statusBanner}
          </p>
        </div>

        <div className="bg-zinc-900/90 text-white px-3.5 py-2 rounded-xl border border-white/10 font-mono tabular-nums text-xs flex items-center gap-3">
          <span>Pengunjung: {liveStats.visitorsInStore}</span>
          <span aria-hidden="true">·</span>
          <span>Pesanan Selesai: {liveStats.ordersServed}</span>
        </div>
      </div>

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-20 transition-transform duration-200"
        style={{
          bottom: dockCollapsed ? '-94px' : '14px',
          width: 'min(940px, 95%)',
        }}
      >
        <div className="flex justify-center mb-1.5">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="px-3 py-1 rounded-t-lg bg-zinc-900/90 text-white text-xs font-medium inline-flex items-center gap-1.5 border border-b-0 border-white/15 cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Tampilkan Kontrol</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Sembunyikan Kontrol</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-zinc-900/92 text-white rounded-xl border border-white/15 px-3 py-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-stone-300 inline-flex items-center gap-1 mr-1">
                <Camera className="w-3.5 h-3.5" />
                <span>Kamera:</span>
              </span>
              {(Object.keys(CAMERA_PRESETS) as CameraPresetKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectCameraPreset(key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activePreset === key
                      ? 'bg-orange-600 text-white'
                      : 'bg-white/10 text-stone-200 hover:bg-white/20'
                  }`}
                >
                  {CAMERA_PRESETS[key].label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-stone-300 inline-flex items-center gap-1 mr-1">
                <Sun className="w-3.5 h-3.5" />
                <span>Suasana:</span>
              </span>
              {(
                [
                  ['day', 'Normal'],
                  ['rush', 'Jam Ramai'],
                  ['evening', 'Malam Hangat'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleAtmosphereChange(key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    atmosphere === key
                      ? 'bg-amber-600 text-white'
                      : 'bg-white/10 text-stone-200 hover:bg-white/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  spawnVisitorFnRef.current?.(
                    'dine-in',
                    'Pelanggan Dine-in baru datang menuju kasir'
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Datangkan Pengunjung (Dine-in)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  spawnVisitorFnRef.current?.(
                    'takeaway',
                    'Pelanggan Takeaway baru datang memesan bungkus'
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-white/12 hover:bg-white/20 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                + Pengunjung Bungkus
              </button>

              {onTriggerLiveDialogue && (
                <button
                  type="button"
                  disabled={isDialogueLoading}
                  onClick={() => onTriggerLiveDialogue('random')}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60 cursor-pointer"
                >
                  <MessageSquareText className="w-3.5 h-3.5" />
                  <span>
                    {isDialogueLoading
                      ? 'Menyiapkan Voice...'
                      : 'Putar Dialog AI (Voice)'}
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSound}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  soundEnabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-white/12 text-stone-200 hover:bg-white/20'
                }`}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Suara &amp; Voice: Aktif</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Aktifkan Suara &amp; Voice</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                aria-label={
                  isPaused ? 'Lanjutkan Simulasi' : 'Jeda Simulasi'
                }
                className="px-2.5 py-1.5 rounded-lg bg-white/12 hover:bg-white/20 text-white text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                {isPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Jalan</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Jeda</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
