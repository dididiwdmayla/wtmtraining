import * as THREE from 'three';
import { resolverImpacto } from '../core/index.js';
import type { Ammo, ResultadoImpacto, Veiculo } from '../core/index.js';

export interface Marca {
  /** Superfície visível onde o furo aparece. */
  objeto: THREE.Object3D;
  ponto: THREE.Vector3;
  normal: THREE.Vector3;
}

export interface ImpactoDetectado {
  resultado: ResultadoImpacto;
  /** m, da boca do cano ao ponto de impacto. */
  distancia: number;
  marca: Marca | null;
}

const raycaster = new THREE.Raycaster();
const inversa = new THREE.Quaternion();

/**
 * Distância da boca do cano até o alvo ao longo da linha de tiro.
 * `null` quando a linha não cruza nada — a retícula então flutua na
 * distância de referência.
 */
export function distanciaNaLinha(
  origem: THREE.Vector3,
  direcao: THREE.Vector3,
  placas: THREE.Object3D,
): number | null {
  raycaster.set(origem, direcao);
  const acertos = raycaster.intersectObject(placas, true);
  return acertos.length > 0 ? acertos[0].distance : null;
}

/**
 * O tiro. Parte SEMPRE da boca do cano, com a direção do cano — nunca
 * da câmera. É por isso que trocar entre terceira pessoa e mira não
 * muda onde a bala vai.
 *
 * Toda a decisão (ricochete, espessura efetiva, módulos atingidos) é do
 * núcleo. Aqui só convertemos mundo em espaço local do alvo.
 */
export function dispararDoCanhao(
  origem: THREE.Vector3,
  direcao: THREE.Vector3,
  alvo: { group: THREE.Object3D; placas: THREE.Object3D; caixas: THREE.Object3D },
  veiculo: Veiculo,
  municao: Ammo,
): ImpactoDetectado | null {
  raycaster.set(origem, direcao);

  const acertos = raycaster.intersectObject(alvo.placas, true);
  if (acertos.length === 0) return null;
  const acerto = acertos[0];
  const placa = veiculo.placas.find((p) => p.id === acerto.object.name);
  if (!placa) return null;

  const pontoLocal = alvo.group.worldToLocal(acerto.point.clone());
  alvo.group.getWorldQuaternion(inversa).invert();
  const direcaoLocal = direcao.clone().applyQuaternion(inversa);

  const resultado = resolverImpacto(
    placa,
    { x: pontoLocal.x, y: pontoLocal.y, z: pontoLocal.z },
    { x: direcaoLocal.x, y: direcaoLocal.y, z: direcaoLocal.z },
    acerto.distance,
    municao,
    veiculo,
  );

  return { resultado, distancia: acerto.distance, marca: marcaNaCaixa(alvo.caixas) };
}

/**
 * A placa atingida está por dentro do caixote, então o furo tem que
 * nascer na superfície que o jogador enxerga — o mesmo raio, a caixa.
 */
function marcaNaCaixa(caixas: THREE.Object3D): Marca | null {
  const acertos = raycaster.intersectObject(caixas, true);
  const acerto = acertos.find((a) => a.face);
  if (!acerto || !acerto.face) return null;
  const normal = acerto.face.normal
    .clone()
    .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(acerto.object.matrixWorld))
    .normalize();
  return { objeto: acerto.object, ponto: acerto.point.clone(), normal };
}
