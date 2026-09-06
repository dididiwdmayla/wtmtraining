import * as THREE from 'three';
import { createSky } from './sky.js';

/** Cena mínima: céu em gradiente, chão com grade, uma luz direcional. */
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(createSky());

  const grade = new THREE.GridHelper(4000, 200, 0x3a4a3a, 0x263226);
  scene.add(grade);

  const sol = new THREE.DirectionalLight(0xfff2e0, 2.4);
  sol.position.set(-400, 600, 300);
  scene.add(sol);

  // Preenchimento fraco para a face oposta ao sol não sumir no preto.
  scene.add(new THREE.AmbientLight(0x334455, 0.5));

  return scene;
}
