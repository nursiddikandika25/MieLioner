import * as THREE from 'three';

export function createWoodPlankTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(0, 0, 512, 512);

  const plankHeight = 64;
  for (let row = 0; row < 8; row++) {
    const y = row * plankHeight;
    const toneShift = ((row * 17) % 24) - 12;
    ctx.fillStyle = `rgb(${142 + toneShift}, ${88 + Math.floor(toneShift * 0.7)}, ${42 + Math.floor(toneShift * 0.4)})`;
    ctx.fillRect(0, y, 512, plankHeight - 2);

    // Subtle wood grain lines
    ctx.strokeStyle = 'rgba(55, 28, 8, 0.18)';
    ctx.lineWidth = 1.5;
    for (let g = 0; g < 6; g++) {
      const gy = y + 8 + g * 9;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(160, gy + ((row + g) % 3) - 1, 340, gy - ((row + g) % 2), 512, gy);
      ctx.stroke();
    }

    // Plank seam
    ctx.fillStyle = '#4a2c11';
    ctx.fillRect(0, y + plankHeight - 2, 512, 2);

    // Staggered vertical joints
    const jointX = ((row * 193) + 96) % 512;
    ctx.fillRect(jointX, y, 2, plankHeight);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createTileFloorTexture(
  baseHex: string,
  lineHex: string,
  repeatCount: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle terrazzo speckles
  for (let i = 0; i < 180; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, 3, 3);
  }

  ctx.strokeStyle = lineHex;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatCount, repeatCount);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createStripedCounterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const stripes = ['#f5f5f4', '#84cc16', '#f5f5f4', '#78350f', '#f5f5f4', '#ea580c'];
  const stripeH = 256 / stripes.length;
  stripes.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, i * stripeH, 256, stripeH);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createMenuBoardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = '#ea580c';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 1004, 236);

  ctx.fillStyle = '#fb923c';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText('MIELIONER', 42, 74);

  ctx.fillStyle = '#a3e635';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('HOT MAKS  ·  POLOS  ·  CEMILAN DAYANG', 310, 70);

  ctx.fillStyle = '#e4e4e7';
  ctx.font = '24px monospace';
  ctx.fillText('Polos Single      Rp 7.000      Keju Parut       Rp 5.000', 42, 134);
  ctx.fillText('Hot Maks Single  Rp 10.000      Keju Leleh       Rp 6.000', 42, 174);
  ctx.fillText('Hot Maks Double  Rp 16.000      Kentang 200gr   Rp 15.000', 42, 214);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(15, 15, 20, 0.55)');
  grad.addColorStop(0.55, 'rgba(15, 15, 20, 0.22)');
  grad.addColorStop(1, 'rgba(15, 15, 20, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
