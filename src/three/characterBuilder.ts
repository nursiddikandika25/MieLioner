import * as THREE from 'three';
import type { StaffId } from '../data/restaurantStaff';

export interface ArticulatedCharacter {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  propBowl?: THREE.Group;
  propTakeaway?: THREE.Group;
  selectionRing?: THREE.Mesh;
}

export interface CharacterStyleConfig {
  shirtColor: number;
  pantsColor: number;
  skinColor: number;
  hairColor: number;
  apronColor?: number;
  hatType?: 'chef' | 'cap' | 'headset' | 'none';
  vestColor?: number;
  staffId?: StaffId;
}

export function buildArticulatedCharacter(
  config: CharacterStyleConfig,
  shadowTexture: THREE.Texture
): ArticulatedCharacter {
  const root = new THREE.Group();

  // Contact shadow grounded at y = 0.015
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
  });
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    shadowMat
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.015;
  root.add(shadowPlane);

  // Optional selection ring for AI staff
  let selectionRing: THREE.Mesh | undefined;
  if (config.staffId) {
    const ringGeo = new THREE.RingGeometry(0.42, 0.52, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xea580c,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.025;
    root.add(selectionRing);
  }

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const skinMat = new THREE.MeshStandardMaterial({
    color: config.skinColor,
    roughness: 0.72,
    metalness: 0.02,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: config.shirtColor,
    roughness: 0.85,
    metalness: 0.04,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: config.pantsColor,
    roughness: 0.9,
    metalness: 0.02,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.45,
    metalness: 0.15,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: config.hairColor,
    roughness: 0.82,
    metalness: 0.05,
  });

  // Legs (pivoted at hip y = 0.72)
  const makeLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.72, 0);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.095, 0.62, 12),
      pantsMat
    );
    thigh.position.y = -0.31;
    thigh.castShadow = true;
    legPivot.add(thigh);

    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.11, 0.28),
      shoeMat
    );
    shoe.position.set(0, -0.665, 0.045);
    shoe.castShadow = true;
    legPivot.add(shoe);

    return legPivot;
  };

  const leftLeg = makeLeg(-0.14);
  const rightLeg = makeLeg(0.14);
  bodyPivot.add(leftLeg, rightLeg);

  // Pelvis / Waist belt
  const pelvis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.16, 14),
    pantsMat
  );
  pelvis.position.y = 0.76;
  pelvis.castShadow = true;
  bodyPivot.add(pelvis);

  // Torso
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.23, 0.56, 16),
    shirtMat
  );
  torso.position.y = 1.11;
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Optional vest (for Manager or Warehouse)
  if (config.vestColor !== undefined) {
    const vestMat = new THREE.MeshStandardMaterial({
      color: config.vestColor,
      roughness: 0.65,
      metalness: 0.08,
    });
    const vest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.275, 0.245, 0.48, 16, 1, false, 0.35, Math.PI * 1.75),
      vestMat
    );
    vest.position.y = 1.11;
    vest.rotation.y = Math.PI * 0.62;
    vest.castShadow = true;
    bodyPivot.add(vest);
  }

  // Optional Apron
  if (config.apronColor !== undefined) {
    const apronMat = new THREE.MeshStandardMaterial({
      color: config.apronColor,
      roughness: 0.88,
      metalness: 0.02,
    });
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.56, 0.04),
      apronMat
    );
    apron.position.set(0, 0.92, 0.24);
    apron.castShadow = true;
    bodyPivot.add(apron);

    // Apron neck strap accent
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.018, 6, 14, Math.PI),
      apronMat
    );
    strap.position.set(0, 1.35, 0.12);
    strap.rotation.x = 0.45;
    bodyPivot.add(strap);
  }

  // Arms (pivoted at shoulder y = 1.32)
  const makeArm = (xOffset: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 1.32, 0);

    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.075, 0.22, 10),
      shirtMat
    );
    sleeve.position.y = -0.11;
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.058, 0.28, 10),
      skinMat
    );
    forearm.position.y = -0.34;
    forearm.castShadow = true;
    armPivot.add(forearm);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 10, 10),
      skinMat
    );
    hand.position.y = -0.49;
    armPivot.add(hand);

    return armPivot;
  };

  const leftArm = makeArm(-0.33);
  const rightArm = makeArm(0.33);
  bodyPivot.add(leftArm, rightArm);

  // Head Group (pivoted at neck y = 1.44)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.44, 0);
  bodyPivot.add(headGroup);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.09, 0.1, 10),
    skinMat
  );
  neck.position.y = 0.03;
  headGroup.add(neck);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 16, 14),
    skinMat
  );
  head.position.y = 0.23;
  head.castShadow = true;
  headGroup.add(head);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.25,
    metalness: 0.1,
  });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
  leftEye.position.set(-0.07, 0.25, 0.185);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
  rightEye.position.set(0.07, 0.25, 0.185);
  headGroup.add(leftEye, rightEye);

  // Hair cap
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.222, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  hairCap.position.set(0, 0.245, -0.015);
  hairCap.rotation.x = -0.25;
  headGroup.add(hairCap);

  // Headgear / Role Accents
  if (config.hatType === 'chef') {
    const toqueMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.75,
      metalness: 0.02,
    });
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.13, 16),
      toqueMat
    );
    band.position.y = 0.43;
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 12),
      toqueMat
    );
    puff.scale.set(1, 0.75, 1);
    puff.position.y = 0.56;
    puff.castShadow = true;
    headGroup.add(band, puff);
  } else if (config.hatType === 'cap') {
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.7,
      metalness: 0.05,
    });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.225, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      capMat
    );
    dome.position.y = 0.27;
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.03, 14, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
      capMat
    );
    brim.position.set(0, 0.34, 0.12);
    headGroup.add(dome, brim);
  } else if (config.hatType === 'headset') {
    const headsetMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.35,
      metalness: 0.65,
    });
    const ear = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10),
      headsetMat
    );
    ear.rotation.z = Math.PI / 2;
    ear.position.set(0.22, 0.24, 0);
    const mic = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8),
      headsetMat
    );
    mic.rotation.z = Math.PI / 2.6;
    mic.rotation.y = 0.5;
    mic.position.set(0.16, 0.18, 0.12);
    headGroup.add(ear, mic);
  }

  // Carryable Serving Tray + Steaming Bowl (for Server / Visitor)
  const propBowl = new THREE.Group();
  const tray = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.025, 16),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.35, metalness: 0.55 })
  );
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.08, 0.1, 14),
    new THREE.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.25, metalness: 0.05 })
  );
  bowl.position.y = 0.06;
  const noodles = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.75, metalness: 0.02 })
  );
  noodles.position.y = 0.08;
  propBowl.add(tray, bowl, noodles);
  propBowl.position.set(0, 1.05, 0.42);
  propBowl.visible = false;
  bodyPivot.add(propBowl);

  // Carryable Takeaway Packing Bag
  const propTakeaway = new THREE.Group();
  const bag = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.26, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85, metalness: 0.02 })
  );
  bag.position.y = -0.14;
  propTakeaway.add(bag);
  propTakeaway.position.set(0.36, 0.92, 0.12);
  propTakeaway.visible = false;
  bodyPivot.add(propTakeaway);

  // Assign staffId tag to all child meshes for raycasting
  if (config.staffId) {
    root.userData.staffId = config.staffId;
    root.traverse((obj) => {
      obj.userData.staffId = config.staffId;
    });
  }

  return {
    root,
    bodyPivot,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    propBowl,
    propTakeaway,
    selectionRing,
  };
}

export function getStaffStyleConfig(staffId: StaffId): CharacterStyleConfig {
  switch (staffId) {
    case 'raka-manager':
      return {
        staffId,
        shirtColor: 0xf8fafc,
        vestColor: 0x1e293b,
        pantsColor: 0x0f172a,
        skinColor: 0xe6b89c,
        hairColor: 0x1c1917,
        hatType: 'none',
      };
    case 'sinta-kasir':
      return {
        staffId,
        shirtColor: 0xea580c,
        apronColor: 0x27272a,
        pantsColor: 0x18181b,
        skinColor: 0xf1c7ad,
        hairColor: 0x292524,
        hatType: 'headset',
      };
    case 'dimas-chef':
      return {
        staffId,
        shirtColor: 0xffffff,
        apronColor: 0x991b1b,
        pantsColor: 0x27272a,
        skinColor: 0xd9a07e,
        hairColor: 0x1c1917,
        hatType: 'chef',
      };
    case 'nadia-snack-bar':
      return {
        staffId,
        shirtColor: 0xfef3c7,
        apronColor: 0x65a30d,
        pantsColor: 0x292524,
        skinColor: 0xf2ccb4,
        hairColor: 0x451a03,
        hatType: 'none',
      };
    case 'bima-server':
      return {
        staffId,
        shirtColor: 0x18181b,
        apronColor: 0xea580c,
        pantsColor: 0x27272a,
        skinColor: 0xdba484,
        hairColor: 0x18181b,
        hatType: 'none',
      };
    case 'tania-inventory':
      return {
        staffId,
        shirtColor: 0x475569,
        vestColor: 0xb45309,
        pantsColor: 0x1e293b,
        skinColor: 0xe8bfa5,
        hairColor: 0x27272a,
        hatType: 'cap',
      };
  }
}

const VISITOR_PALETTE = [
  { shirt: 0x2563eb, pants: 0x1e293b, hair: 0x1c1917, skin: 0xebc2a7 },
  { shirt: 0x16a34a, pants: 0x27272a, hair: 0x292524, skin: 0xdba585 },
  { shirt: 0xd97706, pants: 0x334155, hair: 0x451a03, skin: 0xf2ccb5 },
  { shirt: 0xe11d48, pants: 0x18181b, hair: 0x18181b, skin: 0xe3b193 },
  { shirt: 0x0d9488, pants: 0x1e293b, hair: 0x3f2305, skin: 0xf0c5aa },
];

export function getVisitorStyleConfig(index: number): CharacterStyleConfig {
  const palette = VISITOR_PALETTE[index % VISITOR_PALETTE.length];
  return {
    shirtColor: palette.shirt,
    pantsColor: palette.pants,
    hairColor: palette.hair,
    skinColor: palette.skin,
    hatType: 'none',
  };
}
