import * as THREE from 'three';
import type { StaffId } from '../data/restaurantStaff';
import {
  createMenuBoardTexture,
  createStripedCounterTexture,
  createTileFloorTexture,
  createWoodPlankTexture,
} from './proceduralTextures';

export interface TableSeatSlot {
  id: string;
  zoneName: string;
  seatPos: THREE.Vector3;
  seatRotationY: number;
  serveStopPos: THREE.Vector3;
  tableBowlPos: THREE.Vector3;
  bowlMesh: THREE.Group;
  occupied: boolean;
}

export interface StaffStationTransform {
  pos: THREE.Vector3;
  rotY: number;
}

export interface RestaurantSceneLayout {
  seatSlots: TableSeatSlot[];
  staffStations: Record<StaffId, StaffStationTransform>;
  staffPatrols: Record<StaffId, THREE.Vector3[]>;
  entrancePos: THREE.Vector3;
  cashierQueuePos: THREE.Vector3;
  kitchenPickupPos: THREE.Vector3;
  takeawayPickupPos: THREE.Vector3;
  fryingPotSteams: THREE.Mesh[];
  warmLights: THREE.PointLight[];
  lampBulbMats: THREE.MeshStandardMaterial[];
  exhaustFan: THREE.Group;
}

function createSteamingBowlProp(): THREE.Group {
  const group = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.09, 0.11, 14),
    new THREE.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.25, metalness: 0.05 })
  );
  bowl.position.y = 0.055;
  const noodle = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.72, metalness: 0.02 })
  );
  noodle.position.y = 0.085;
  const chiliDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55, metalness: 0.02 })
  );
  chiliDot.position.set(0.03, 0.19, 0.02);
  group.add(bowl, noodle, chiliDot);
  group.visible = false;
  return group;
}

function buildDiningChair(colorHex: number): THREE.Group {
  const chair = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.48,
    metalness: 0.08,
  });
  const legMat = new THREE.MeshStandardMaterial({
    color: 0xa1a1aa,
    roughness: 0.3,
    metalness: 0.85,
  });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.5), seatMat);
  seat.position.y = 0.44;
  seat.castShadow = true;
  chair.add(seat);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.07), seatMat);
  backrest.position.set(0, 0.68, -0.22);
  backrest.castShadow = true;
  chair.add(backrest);

  const legOffsets: Array<[number, number]> = [
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ];
  for (const [lx, lz] of legOffsets) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.02, 0.43, 8),
      legMat
    );
    leg.position.set(lx, 0.215, lz);
    chair.add(leg);
  }
  return chair;
}

export function buildMieLionerScene(
  scene: THREE.Scene,
  maxAnisotropy: number
): RestaurantSceneLayout {
  const woodTex = createWoodPlankTexture(maxAnisotropy);
  const indoorTileTex = createTileFloorTexture('#e7e5e4', '#d6d3d1', 6, maxAnisotropy);
  const patioTileTex = createTileFloorTexture('#cbd5e1', '#94a3b8', 10, maxAnisotropy);
  const counterTex = createStripedCounterTexture(maxAnisotropy);
  const menuBoardTex = createMenuBoardTexture(maxAnisotropy);

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.68,
    metalness: 0.04,
  });
  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.35,
    metalness: 0.78,
  });
  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.22,
    metalness: 0.88,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf5f5f4,
    roughness: 0.85,
    metalness: 0.02,
  });
  const orangeWallMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.75,
    metalness: 0.04,
  });
  const redBoothMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.72,
    metalness: 0.05,
  });

  // 1. Exterior / Patio Ground (extended beyond playable space)
  const patioGround = new THREE.Mesh(
    new THREE.PlaneGeometry(54, 46),
    new THREE.MeshStandardMaterial({
      map: patioTileTex,
      roughness: 0.88,
      metalness: 0.02,
    })
  );
  patioGround.rotation.x = -Math.PI / 2;
  patioGround.position.set(0, 0, 2);
  patioGround.receiveShadow = true;
  scene.add(patioGround);

  // 2. Indoor Floor Slab (raised +0.02 to avoid coplanar Z-fighting)
  const indoorFloor = new THREE.Mesh(
    new THREE.BoxGeometry(17.5, 0.04, 10.5),
    new THREE.MeshStandardMaterial({
      map: indoorTileTex,
      roughness: 0.55,
      metalness: 0.08,
    })
  );
  indoorFloor.position.set(0, 0.02, -2.5);
  indoorFloor.receiveShadow = true;
  scene.add(indoorFloor);

  // Timber deck inlay on left indoor dining side
  const timberZoneDeck = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.02, 6.4),
    woodMat
  );
  timberZoneDeck.position.set(-4.3, 0.045, -1.6);
  timberZoneDeck.receiveShadow = true;
  scene.add(timberZoneDeck);

  // 3. Back & Side Architectural Walls (cutaway view on front so camera sees everything)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(17.6, 5.2, 0.3), wallMat);
  backWall.position.set(0, 2.6, -7.85);
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Signature orange back accent wall in Kitchen/Storage zone
  const orangeBackPanel = new THREE.Mesh(
    new THREE.BoxGeometry(6.6, 4.8, 0.1),
    orangeWallMat
  );
  orangeBackPanel.position.set(5.3, 2.45, -7.65);
  scene.add(orangeBackPanel);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 10.6), wallMat);
  leftWall.position.set(-8.8, 2.6, -2.5);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.2, 10.6), wallMat);
  rightWall.position.set(8.8, 2.6, -2.5);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // Storefront steel columns along glass patio facade (z = 2.7)
  for (const colX of [-8.4, -3.4, 3.6, 8.4]) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 5.1, 14),
      darkSteelMat
    );
    col.position.set(colX, 2.55, 2.7);
    col.castShadow = true;
    scene.add(col);
  }
  const frontBeam = new THREE.Mesh(
    new THREE.BoxGeometry(17.4, 0.28, 0.3),
    darkSteelMat
  );
  frontBeam.position.set(0, 5.05, 2.7);
  scene.add(frontBeam);

  // 4. Mezzanine Lantai 2 (Upper Timber Balcony on back-left/center)
  const mezzanineDeck = new THREE.Mesh(
    new THREE.BoxGeometry(12.2, 0.24, 3.2),
    woodMat
  );
  mezzanineDeck.position.set(-2.3, 2.75, -6.1);
  mezzanineDeck.castShadow = true;
  mezzanineDeck.receiveShadow = true;
  scene.add(mezzanineDeck);

  // Mezzanine support pillars & upper timber frames
  for (const px of [-7.8, -4.6, -1.4, 1.8, 3.6]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 4.9, 0.35),
      woodMat
    );
    pillar.position.set(px, 2.45, -4.65);
    pillar.castShadow = true;
    scene.add(pillar);
  }

  // Mezzanine safety railing
  const railBar = new THREE.Mesh(
    new THREE.BoxGeometry(12.2, 0.08, 0.08),
    darkSteelMat
  );
  railBar.position.set(-2.3, 3.65, -4.55);
  scene.add(railBar);

  // Mezzanine bar stools & high tables
  for (const mx of [-5.8, -3.0, 0.2]) {
    const mTable = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.08, 0.8),
      woodMat
    );
    mTable.position.set(mx, 3.55, -5.8);
    scene.add(mTable);

    for (const sx of [mx - 0.38, mx + 0.38]) {
      const stool = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.55, 10),
        new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.45 })
      );
      stool.position.set(sx, 3.15, -5.15);
      scene.add(stool);
    }
  }

  // 5. Meja Kasir & Bar Minuman (Center-Right L-shaped striped counter)
  const counterMat = new THREE.MeshStandardMaterial({
    map: counterTex,
    roughness: 0.45,
    metalness: 0.08,
  });
  const counterFront = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 1.05, 0.85),
    counterMat
  );
  counterFront.position.set(2.4, 0.54, -1.7);
  counterFront.castShadow = true;
  counterFront.receiveShadow = true;
  scene.add(counterFront);

  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(5.76, 0.08, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.25, metalness: 0.1 })
  );
  counterTop.position.set(2.4, 1.09, -1.7);
  counterTop.castShadow = true;
  scene.add(counterTop);

  // POS Register Screen
  const posBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.2, 0.24),
    darkSteelMat
  );
  posBase.position.set(1.2, 1.22, -1.65);
  const posScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.3, 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    })
  );
  posScreen.position.set(1.2, 1.42, -1.65);
  posScreen.rotation.x = -0.2;
  scene.add(posBase, posScreen);

  // Espresso / Drink Machine on Bar
  const drinkMachine = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.52, 0.48),
    stainlessMat
  );
  drinkMachine.position.set(3.5, 1.38, -1.75);
  drinkMachine.castShadow = true;
  scene.add(drinkMachine);

  // Overhead Menu Board Lightbox
  const menuBoardFrame = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 1.15, 0.14),
    darkSteelMat
  );
  menuBoardFrame.position.set(2.4, 3.25, -1.75);
  const menuBoardFace = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 1.02),
    new THREE.MeshStandardMaterial({
      map: menuBoardTex,
      emissive: 0xffffff,
      emissiveMap: menuBoardTex,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    })
  );
  menuBoardFace.position.set(2.4, 3.25, -1.67);
  scene.add(menuBoardFrame, menuBoardFace);

  // 6. Dapur Produksi & Gudang (Rear-Right)
  const kitchenPrepCounter = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.95, 0.9),
    stainlessMat
  );
  kitchenPrepCounter.position.set(4.8, 0.49, -5.2);
  kitchenPrepCounter.castShadow = true;
  scene.add(kitchenPrepCounter);

  // Twin Noodle Boiling / Hot Maks Wok Pots + Steam Cubes
  const fryingPotSteams: THREE.Mesh[] = [];
  for (const potX of [3.4, 4.3]) {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.22, 0.26, 16),
      stainlessMat
    );
    pot.position.set(potX, 1.08, -5.2);
    const burnerGlow = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.25, 16),
      new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide })
    );
    burnerGlow.rotation.x = -Math.PI / 2;
    burnerGlow.position.set(potX, 0.97, -5.2);

    const steam = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        roughness: 1,
      })
    );
    steam.position.set(potX, 1.35, -5.2);
    fryingPotSteams.push(steam);
    scene.add(pot, burnerGlow, steam);
  }

  // Double Glass Refrigerator in Storage Zone
  const fridge = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 2.35, 0.85),
    stainlessMat
  );
  fridge.position.set(7.2, 1.2, -6.9);
  fridge.castShadow = true;
  const fridgeGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.85),
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.15,
      metalness: 0.15,
      transparent: true,
      opacity: 0.55,
    })
  );
  fridgeGlass.position.set(7.2, 1.28, -6.46);
  scene.add(fridge, fridgeGlass);

  // Storage Crate Stacks (Packing & Ingredients)
  for (let i = 0; i < 3; i++) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.42, 0.55),
      new THREE.MeshStandardMaterial({
        color: i === 1 ? 0xd97706 : 0x78350f,
        roughness: 0.78,
      })
    );
    crate.position.set(5.4 + (i % 2) * 0.72, 0.23 + (i === 2 ? 0.42 : 0), -7.0);
    crate.castShadow = true;
    scene.add(crate);
  }

  // 7. Dining Furniture + Interactive Seat Slots (Booth Timber, Indoor & Teras Outdoor)
  const seatSlots: TableSeatSlot[] = [];

  // A. 2 Indoor Booths against wood partition (red cushioned booths)
  for (const [idx, bx] of [-6.4, -3.8].entries()) {
    const boothTable = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.08, 0.9),
      woodMat
    );
    boothTable.position.set(bx, 0.76, -3.5);
    boothTable.castShadow = true;
    const tableLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.72, 10),
      darkSteelMat
    );
    tableLeg.position.set(bx, 0.36, -3.5);

    const boothSeat = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.45, 0.58),
      redBoothMat
    );
    boothSeat.position.set(bx, 0.24, -4.25);
    const boothBack = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.75, 0.16),
      redBoothMat
    );
    boothBack.position.set(bx, 0.78, -4.5);

    const bowlMesh = createSteamingBowlProp();
    bowlMesh.position.set(bx, 0.81, -3.55);
    scene.add(boothTable, tableLeg, boothSeat, boothBack, bowlMesh);

    seatSlots.push({
      id: `booth-${idx + 1}`,
      zoneName: `Booth Timber ${idx + 1}`,
      seatPos: new THREE.Vector3(bx, 0.04, -4.18),
      seatRotationY: 0,
      serveStopPos: new THREE.Vector3(bx, 0.04, -2.55),
      tableBowlPos: new THREE.Vector3(bx, 0.81, -3.55),
      bowlMesh,
      occupied: false,
    });
  }

  // B. 2 Communal Timber Tables in Indoor Hall
  for (const [idx, tz] of [-0.9, 1.0].entries()) {
    const tx = -4.5;
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.09, 0.95),
      woodMat
    );
    tableTop.position.set(tx, 0.76, tz);
    tableTop.castShadow = true;

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.7), woodMat);
    legL.position.set(tx - 1.0, 0.36, tz);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.7), woodMat);
    legR.position.set(tx + 1.0, 0.36, tz);

    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.08, 0.42),
      woodMat
    );
    bench.position.set(tx, 0.44, tz + 0.72);
    bench.castShadow = true;

    const bowlMesh = createSteamingBowlProp();
    bowlMesh.position.set(tx - 0.4, 0.81, tz + 0.1);
    scene.add(tableTop, legL, legR, bench, bowlMesh);

    seatSlots.push({
      id: `timber-${idx + 1}`,
      zoneName: `Meja Timber ${idx + 1}`,
      seatPos: new THREE.Vector3(tx - 0.4, 0.04, tz + 0.72),
      seatRotationY: Math.PI,
      serveStopPos: new THREE.Vector3(tx + 1.5, 0.04, tz),
      tableBowlPos: new THREE.Vector3(tx - 0.4, 0.81, tz + 0.1),
      bowlMesh,
      occupied: false,
    });
  }

  // C. 4 Outdoor Patio Tables with Lime-Green & Orange Chairs (signature MieLioner colors)
  const patioCoords: Array<[number, number]> = [
    [-5.2, 5.4],
    [-1.6, 5.4],
    [2.0, 5.4],
    [-3.4, 8.2],
  ];
  patioCoords.forEach(([px, pz], idx) => {
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.06, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.4, metalness: 0.1 })
    );
    tableTop.position.set(px, 0.74, pz);
    tableTop.castShadow = true;

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.25, 0.71, 10),
      darkSteelMat
    );
    pedestal.position.set(px, 0.36, pz);

    const chairGreen = buildDiningChair(0x84cc16);
    chairGreen.position.set(px - 0.72, 0, pz);
    chairGreen.rotation.y = Math.PI / 2;

    const chairOrange = buildDiningChair(0xea580c);
    chairOrange.position.set(px + 0.72, 0, pz);
    chairOrange.rotation.y = -Math.PI / 2;

    const bowlMesh = createSteamingBowlProp();
    bowlMesh.position.set(px - 0.18, 0.78, pz);
    scene.add(tableTop, pedestal, chairGreen, chairOrange, bowlMesh);

    seatSlots.push({
      id: `patio-${idx + 1}`,
      zoneName: `Teras Outdoor ${idx + 1}`,
      seatPos: new THREE.Vector3(px - 0.72, 0, pz),
      seatRotationY: Math.PI / 2,
      serveStopPos: new THREE.Vector3(px, 0, pz - 1.15),
      tableBowlPos: new THREE.Vector3(px - 0.18, 0.78, pz),
      bowlMesh,
      occupied: false,
    });
  });

  // 8. Warm Bistro Pendant Lamps & Kitchen Exhaust Fan for Realistic Atmosphere
  const warmLights: THREE.PointLight[] = [];
  const lampBulbMats: THREE.MeshStandardMaterial[] = [];

  for (const [lx, ly, lz] of [
    [1.4, 3.85, -1.7],
    [3.4, 3.85, -1.7],
    [-4.5, 3.65, -0.9],
    [-4.5, 3.65, 1.0],
  ] as Array<[number, number, number]>) {
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 1.15, 6),
      darkSteelMat
    );
    cord.position.set(lx, ly + 0.65, lz);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.22, 14, 1, true),
      darkSteelMat
    );
    shade.position.set(lx, ly, lz);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });
    lampBulbMats.push(bulbMat);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), bulbMat);
    bulb.position.set(lx, ly - 0.06, lz);
    scene.add(cord, shade, bulb);
  }

  // Two cozy warm point lights (lightweight, non-shadow-casting)
  const counterWarmLight = new THREE.PointLight(0xffedd5, 2.2, 14, 1.5);
  counterWarmLight.position.set(2.4, 3.4, -1.6);
  const diningWarmLight = new THREE.PointLight(0xfde68a, 1.8, 14, 1.5);
  diningWarmLight.position.set(-4.5, 3.3, 0.1);
  scene.add(counterWarmLight, diningWarmLight);
  warmLights.push(counterWarmLight, diningWarmLight);

  // Kitchen Exhaust Hood & Spinning Fan
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.55, 1.1),
    stainlessMat
  );
  hood.position.set(3.85, 3.35, -5.2);
  scene.add(hood);

  const exhaustFan = new THREE.Group();
  exhaustFan.position.set(3.85, 3.06, -5.2);
  const fanBladeMat = new THREE.MeshStandardMaterial({
    color: 0x3f3f46,
    roughness: 0.35,
    metalness: 0.7,
  });
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.02, 0.14),
      fanBladeMat
    );
    blade.rotation.y = (b * Math.PI) / 4;
    exhaustFan.add(blade);
  }
  scene.add(exhaustFan);

  // Home positions for all 6 AI Employees
  const staffStations: Record<StaffId, StaffStationTransform> = {
    'raka-manager': {
      pos: new THREE.Vector3(-1.4, 2.87, -5.6),
      rotY: 0.2,
    },
    'sinta-kasir': {
      pos: new THREE.Vector3(1.1, 0.04, -2.65),
      rotY: 0,
    },
    'dimas-chef': {
      pos: new THREE.Vector3(3.85, 0.04, -6.1),
      rotY: 0,
    },
    'nadia-snack-bar': {
      pos: new THREE.Vector3(3.4, 0.04, -2.65),
      rotY: 0,
    },
    'bima-server': {
      pos: new THREE.Vector3(-0.9, 0.04, -0.8),
      rotY: -0.4,
    },
    'tania-inventory': {
      pos: new THREE.Vector3(6.1, 0.04, -5.9),
      rotY: -0.4,
    },
  };

  // Multi-point realistic restaurant work patrol waypoints for each AI Employee
  const staffPatrols: Record<StaffId, THREE.Vector3[]> = {
    'raka-manager': [
      new THREE.Vector3(-5.2, 2.87, -5.1),
      new THREE.Vector3(-1.4, 2.87, -5.1),
      new THREE.Vector3(1.4, 2.87, -5.1),
    ],
    'sinta-kasir': [
      new THREE.Vector3(1.1, 0.04, -2.65),
      new THREE.Vector3(1.85, 0.04, -2.65),
      new THREE.Vector3(0.45, 0.04, -2.65),
    ],
    'dimas-chef': [
      new THREE.Vector3(3.4, 0.04, -6.05),
      new THREE.Vector3(4.35, 0.04, -6.05),
      new THREE.Vector3(3.0, 0.04, -4.45),
    ],
    'nadia-snack-bar': [
      new THREE.Vector3(3.4, 0.04, -2.65),
      new THREE.Vector3(4.4, 0.04, -2.85),
      new THREE.Vector3(2.65, 0.04, -2.65),
    ],
    'bima-server': [
      new THREE.Vector3(-0.9, 0.04, -0.8),
      new THREE.Vector3(-2.3, 0.04, 0.4),
      new THREE.Vector3(-0.5, 0.04, 2.0),
    ],
    'tania-inventory': [
      new THREE.Vector3(6.6, 0.04, -5.8),
      new THREE.Vector3(5.6, 0.04, -6.2),
      new THREE.Vector3(4.7, 0.04, -4.3),
    ],
  };

  return {
    seatSlots,
    staffStations,
    staffPatrols,
    entrancePos: new THREE.Vector3(0.5, 0, 11.2),
    cashierQueuePos: new THREE.Vector3(1.1, 0.04, -0.75),
    kitchenPickupPos: new THREE.Vector3(2.8, 0.04, -4.1),
    takeawayPickupPos: new THREE.Vector3(1.85, 0.04, -0.75),
    fryingPotSteams,
    warmLights,
    lampBulbMats,
    exhaustFan,
  };
}
