import * as THREE from 'three';

const RAIO_DECAL_M = 0.05;
/** Empurra o decal para fora da placa, na direção da normal, contra z-fighting. */
const OFFSET_M = 0.01;

/**
 * Marca simples e persistente no ponto de impacto. Fica como filha da
 * própria placa atingida, então herda a orientação dela sem cálculo
 * nenhum aqui.
 */
export function marcarImpacto(placaMesh: THREE.Object3D, pontoMundo: THREE.Vector3): void {
  const local = placaMesh.worldToLocal(pontoMundo.clone());
  local.z += OFFSET_M;

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
  placaMesh.add(decal);
}
