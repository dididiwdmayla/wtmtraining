import * as THREE from 'three';

const RAIO_DECAL_M = 0.05;
/** Empurra o decal para fora da placa, na direção da normal, contra z-fighting. */
const OFFSET_M = 0.01;

const NORMAL_PADRAO = new THREE.Vector3(0, 0, 1);

/**
 * Marca simples e persistente no ponto de impacto. Fica como filha da
 * superfície atingida, então acompanha o veículo sem cálculo nenhum
 * aqui; a normal do mundo vira orientação local do decal.
 */
export function marcarImpacto(
  superficie: THREE.Object3D,
  pontoMundo: THREE.Vector3,
  normalMundo: THREE.Vector3,
): void {
  const giroInverso = superficie.getWorldQuaternion(new THREE.Quaternion()).invert();
  const normalLocal = normalMundo.clone().applyQuaternion(giroInverso).normalize();
  const local = superficie.worldToLocal(pontoMundo.clone()).addScaledVector(normalLocal, OFFSET_M);

  const geometry = new THREE.CircleGeometry(RAIO_DECAL_M, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0x0a0a0a,
    transparent: true,
    opacity: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const decal = new THREE.Mesh(geometry, material);
  decal.position.copy(local);
  decal.quaternion.setFromUnitVectors(NORMAL_PADRAO, normalLocal);
  superficie.add(decal);
}
