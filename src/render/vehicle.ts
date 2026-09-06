import * as THREE from 'three';
import type { Veiculo } from '../core/index.js';
import { thicknessToColor } from './color.js';

const COR_MODULO: Partial<Record<string, number>> = {
  municao: 0xff5533,
  culatra: 0xffaa33,
  motor: 0x556070,
  transmissao: 0x7a8899,
  tripulante: 0x33bbff,
  combustivel: 0xffee33,
};

const NORMAL_PADRAO = new THREE.Vector3(0, 0, 1);

export interface VehicleMesh {
  group: THREE.Group;
  setModulesVisible(visivel: boolean): void;
}

/**
 * Malha do veículo a partir do JSON: cada placa é um plano visível,
 * cada módulo é uma caixa invisível por padrão (wireframe no debug).
 * Não há outra fonte de geometria — nada de .glb.
 */
export function buildVehicleMesh(veiculo: Veiculo): VehicleMesh {
  const group = new THREE.Group();
  group.name = veiculo.id;

  const placas = new THREE.Group();
  placas.name = 'placas';
  for (const placa of veiculo.placas) {
    const geometry = new THREE.PlaneGeometry(placa.tamanho.largura, placa.tamanho.altura);
    const material = new THREE.MeshLambertMaterial({
      color: thicknessToColor(placa.espessuraMm),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = placa.id;
    mesh.position.set(placa.centro.x, placa.centro.y, placa.centro.z);
    const normal = new THREE.Vector3(placa.normal.x, placa.normal.y, placa.normal.z).normalize();
    mesh.quaternion.setFromUnitVectors(NORMAL_PADRAO, normal);
    placas.add(mesh);
  }
  group.add(placas);

  const modulos = new THREE.Group();
  modulos.name = 'modulos';
  modulos.visible = false;
  for (const modulo of veiculo.modulos) {
    const geometry = new THREE.BoxGeometry(modulo.tamanho.x, modulo.tamanho.y, modulo.tamanho.z);
    const material = new THREE.MeshBasicMaterial({
      color: COR_MODULO[modulo.tipo] ?? 0xffffff,
      wireframe: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = modulo.id;
    mesh.position.set(modulo.centro.x, modulo.centro.y, modulo.centro.z);
    modulos.add(mesh);
  }
  group.add(modulos);

  return {
    group,
    setModulesVisible(visivel: boolean) {
      modulos.visible = visivel;
    },
  };
}
