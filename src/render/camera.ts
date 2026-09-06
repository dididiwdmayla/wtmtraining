import * as THREE from 'three';
import { CAMADA_CLARAO } from './flash.js';
import type { Blindado } from './tank.js';

/** Distância padrão do alvo na cena de treino: o alvo a 1000 m. */
export const ALVO_DISTANCIA_M = 1000;

/** Maior que o raio da esfera do céu, senão ela é cortada pelo far plane. */
const FAR_PLANE_M = 6000;
const NEAR_PLANE_M = 0.5;

const FOV_TERCEIRA = 55;

const DISTANCIA_CAMERA_M = 14;
const ALTURA_CAMERA_M = 5;
const INCLINACAO_CAMERA = 9 * (Math.PI / 180);

export type ModoCamera = 'terceira' | 'mira';

/** Extremos do zoom da mira. Vêm de `data/controles.json`. */
export interface LimitesZoom {
  fovMaxGraus: number;
  fovMinGraus: number;
}

export interface Cameras {
  ativa(): THREE.PerspectiveCamera;
  modo(): ModoCamera;
  alternar(): ModoCamera;
  /** FOV vertical, em graus, da câmera que está na tela. */
  fovAtivoGraus(): number;
  fovMiraGraus(): number;
  /** Zoom contínuo da mira. Trava nos extremos declarados no JSON. */
  definirFovMiraGraus(graus: number): void;
  /** Ampliação da mira em relação ao FOV mais aberto dela. */
  ampliacao(): number;
  redimensionar(aspect: number): void;
}

/**
 * Duas câmeras, as duas presas à hierarquia do blindado:
 *
 * - terceira pessoa: filha da TORRE, atrás e acima. Segue a guinada da
 *   torre, não a do casco — o casco pode girar embaixo dela.
 * - mira: filha do CANHÃO, na origem dele, com FOV estreito e zoom
 *   contínuo entre os limites do JSON.
 *
 * Nenhuma das duas participa do tiro. O raycast sai sempre da boca do
 * cano, então trocar de câmera não muda uma vírgula da balística.
 */
export function criarCameras(aspect: number, blindado: Blindado, zoom: LimitesZoom): Cameras {
  const terceira = new THREE.PerspectiveCamera(FOV_TERCEIRA, aspect, NEAR_PLANE_M, FAR_PLANE_M);
  terceira.name = 'camera-terceira';
  terceira.position.set(0, ALTURA_CAMERA_M, -DISTANCIA_CAMERA_M);
  // YXZ: primeiro vira para a frente da torre (+z), depois inclina.
  terceira.rotation.order = 'YXZ';
  terceira.rotation.set(-INCLINACAO_CAMERA, Math.PI, 0);
  // O clarão da boca só faz sentido de fora: na mira a câmera está
  // dentro do cano e a labareda cobriria a retícula inteira.
  terceira.layers.enable(CAMADA_CLARAO);
  blindado.torre.add(terceira);

  const mira = new THREE.PerspectiveCamera(zoom.fovMaxGraus, aspect, NEAR_PLANE_M, FAR_PLANE_M);
  mira.name = 'camera-mira';
  mira.position.set(0, 0, 0);
  mira.rotation.order = 'YXZ';
  mira.rotation.set(0, Math.PI, 0);
  blindado.canhao.add(mira);

  let modo: ModoCamera = 'terceira';

  return {
    ativa: () => (modo === 'terceira' ? terceira : mira),
    modo: () => modo,
    alternar() {
      modo = modo === 'terceira' ? 'mira' : 'terceira';
      return modo;
    },
    fovAtivoGraus: () => (modo === 'terceira' ? terceira.fov : mira.fov),
    fovMiraGraus: () => mira.fov,
    definirFovMiraGraus(graus: number) {
      const travado = Math.min(zoom.fovMaxGraus, Math.max(zoom.fovMinGraus, graus));
      if (travado === mira.fov) return;
      mira.fov = travado;
      mira.updateProjectionMatrix();
    },
    ampliacao: () => zoom.fovMaxGraus / mira.fov,
    redimensionar(novoAspect: number) {
      for (const camera of [terceira, mira]) {
        camera.aspect = novoAspect;
        camera.updateProjectionMatrix();
      }
    },
  };
}
