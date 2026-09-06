import * as THREE from 'three';

/**
 * Faixa de referência fixa (não por veículo) para que a mesma espessura
 * sempre pinte a mesma cor, comparável entre veículos diferentes.
 */
const MM_FINO = 0;
const MM_GROSSO = 600;

const HUE_FINO = 0.58; // azul: pouco blindado
const HUE_GROSSO = 0.0; // vermelho: muito blindado

export function thicknessToColor(espessuraMm: number): THREE.Color {
  const t = Math.min(1, Math.max(0, (espessuraMm - MM_FINO) / (MM_GROSSO - MM_FINO)));
  const hue = HUE_FINO + (HUE_GROSSO - HUE_FINO) * t;
  return new THREE.Color().setHSL(hue, 0.75, 0.5);
}
