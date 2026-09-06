import * as THREE from 'three';
import type { ParteVeiculo, Veiculo } from '../core/index.js';

/** Caixa alinhada aos eixos locais do veículo. */
export interface Caixa {
  centro: THREE.Vector3;
  tamanho: THREE.Vector3;
}

export interface CaixasDoVeiculo {
  casco: Caixa;
  torre: Caixa;
}

const NORMAL_PADRAO = new THREE.Vector3(0, 0, 1);

/**
 * Envelope de cada corpo a partir dos MESMOS dados que a colisão usa:
 * os cantos de cada placa e as caixas dos módulos daquela parte. Nada
 * aqui inventa geometria — se o JSON mudar, a caixa muda junto, então
 * não existe segunda fonte de verdade para desalinhar.
 */
export function caixasDoVeiculo(veiculo: Veiculo): CaixasDoVeiculo {
  return {
    casco: envelope(veiculo, 'casco'),
    torre: envelope(veiculo, 'torre'),
  };
}

function envelope(veiculo: Veiculo, parte: ParteVeiculo): Caixa {
  const caixa = new THREE.Box3();

  for (const placa of veiculo.placas) {
    if (placa.parte !== parte) continue;
    const centro = new THREE.Vector3(placa.centro.x, placa.centro.y, placa.centro.z);
    const normal = new THREE.Vector3(placa.normal.x, placa.normal.y, placa.normal.z).normalize();
    const giro = new THREE.Quaternion().setFromUnitVectors(NORMAL_PADRAO, normal);
    const u = new THREE.Vector3(1, 0, 0).applyQuaternion(giro).multiplyScalar(placa.tamanho.largura / 2);
    const v = new THREE.Vector3(0, 1, 0).applyQuaternion(giro).multiplyScalar(placa.tamanho.altura / 2);
    for (const su of [-1, 1]) {
      for (const sv of [-1, 1]) {
        caixa.expandByPoint(
          centro.clone().addScaledVector(u, su).addScaledVector(v, sv),
        );
      }
    }
  }

  for (const modulo of veiculo.modulos) {
    if (modulo.parte !== parte) continue;
    const centro = new THREE.Vector3(modulo.centro.x, modulo.centro.y, modulo.centro.z);
    const meio = new THREE.Vector3(modulo.tamanho.x / 2, modulo.tamanho.y / 2, modulo.tamanho.z / 2);
    caixa.expandByPoint(centro.clone().sub(meio));
    caixa.expandByPoint(centro.clone().add(meio));
  }

  if (caixa.isEmpty()) throw new Error(`veículo ${veiculo.id} sem geometria para "${parte}"`);

  return {
    centro: caixa.getCenter(new THREE.Vector3()),
    tamanho: caixa.getSize(new THREE.Vector3()),
  };
}
