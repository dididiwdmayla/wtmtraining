import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Alvo da cena de inspeção: o veículo a 1000 m do artilheiro. */
export const ALVO_DISTANCIA_M = 1000;
const ALTURA_ATIRADOR_M = 2.0;

/** Maior que o raio da esfera do céu, senão ela é cortada pelo far plane. */
const FAR_PLANE_M = 6000;

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(35, aspect, 1, FAR_PLANE_M);
  camera.position.set(0, ALTURA_ATIRADOR_M, ALVO_DISTANCIA_M);
  return camera;
}

/**
 * Órbita é temporária: serve para inspecionar o veículo de todos os
 * ângulos agora. O jogo real mira, não orbita.
 */
export function createOrbitControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
  alvo: THREE.Vector3,
): OrbitControls {
  const controls = new OrbitControls(camera, domElement);
  controls.target.copy(alvo);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = ALVO_DISTANCIA_M * 1.5;
  controls.update();
  return controls;
}
