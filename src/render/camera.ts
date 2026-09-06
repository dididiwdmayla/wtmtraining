import * as THREE from 'three';
import type { Blindado } from './tank.js';

/** Distância padrão do alvo na cena de treino: o alvo a 1000 m. */
export const ALVO_DISTANCIA_M = 1000;

/** Maior que o raio da esfera do céu, senão ela é cortada pelo far plane. */
const FAR_PLANE_M = 6000;
const NEAR_PLANE_M = 0.5;

const FOV_TERCEIRA = 55;
/** Mira estreita: é o zoom que torna o erro em mrad legível na tela. */
const FOV_MIRA = 8;

const DISTANCIA_CAMERA_M = 14;
const ALTURA_CAMERA_M = 5;
const INCLINACAO_CAMERA = 9 * (Math.PI / 180);

export type ModoCamera = 'terceira' | 'mira';

export interface Cameras {
  ativa(): THREE.PerspectiveCamera;
  modo(): ModoCamera;
  alternar(): ModoCamera;
  redimensionar(aspect: number): void;
}

/**
 * Duas câmeras, as duas presas à hierarquia do blindado:
 *
 * - terceira pessoa: filha da TORRE, atrás e acima. Segue a guinada da
 *   torre, não a do casco — o casco pode girar embaixo dela.
 * - mira: filha do CANHÃO, na origem dele, com FOV estreito.
 *
 * Nenhuma das duas participa do tiro. O raycast sai sempre da boca do
 * cano, então trocar de câmera não muda uma vírgula da balística.
 */
export function criarCameras(aspect: number, blindado: Blindado): Cameras {
  const terceira = new THREE.PerspectiveCamera(FOV_TERCEIRA, aspect, NEAR_PLANE_M, FAR_PLANE_M);
  terceira.name = 'camera-terceira';
  terceira.position.set(0, ALTURA_CAMERA_M, -DISTANCIA_CAMERA_M);
  // YXZ: primeiro vira para a frente da torre (+z), depois inclina.
  terceira.rotation.order = 'YXZ';
  terceira.rotation.set(-INCLINACAO_CAMERA, Math.PI, 0);
  blindado.torre.add(terceira);

  const mira = new THREE.PerspectiveCamera(FOV_MIRA, aspect, NEAR_PLANE_M, FAR_PLANE_M);
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
    redimensionar(novoAspect: number) {
      for (const camera of [terceira, mira]) {
        camera.aspect = novoAspect;
        camera.updateProjectionMatrix();
      }
    },
  };
}
