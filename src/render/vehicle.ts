import * as THREE from 'three';
import type { Canhao, Veiculo } from '../core/index.js';
import { thicknessToColor } from './color.js';
import { caixasDoVeiculo, type Caixa } from './boxes.js';

const COR_MODULO: Partial<Record<string, number>> = {
  municao: 0xff5533,
  culatra: 0xffaa33,
  motor: 0x556070,
  transmissao: 0x7a8899,
  tripulante: 0x33bbff,
  combustivel: 0xffee33,
};

const COR_CASCO = 0x4a5a3e;
const COR_TORRE = 0x56664a;
const COR_CANO = 0x3b4733;
const COR_ARESTA = 0x1c231a;

const NORMAL_PADRAO = new THREE.Vector3(0, 0, 1);

export interface VehicleMesh {
  group: THREE.Group;
  /** Fonte de verdade da colisão: é contra isto que o raycast corre. */
  placas: THREE.Group;
  /** Representação visual em caixas: é isto que o decal marca. */
  caixas: THREE.Group;
  /** Troca as caixas pelas placas coloridas por espessura e pelos módulos. */
  setDebugVisible(visivel: boolean): void;
}

/**
 * O veículo continua nascendo de `data/vehicles/*.json`: as placas do
 * JSON seguem sendo a geometria de colisão e a espessura, os módulos
 * seguem sendo o que vale ponto. O que mudou é só a leitura — caixote
 * para o casco, caixa menor para a torre, cilindro para o cano — porque
 * caixa chapada lê melhor a mil metros que um plano solto no ar.
 * Nada de .glb: uma fonte de verdade só.
 */
export function buildVehicleMesh(veiculo: Veiculo): VehicleMesh {
  const group = new THREE.Group();
  group.name = veiculo.id;

  const placas = new THREE.Group();
  placas.name = 'placas';
  // Invisíveis, mas ainda no grafo: o raycaster do three não olha
  // `visible`, então a colisão continua exatamente a mesma.
  placas.visible = false;
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

  const envelopes = caixasDoVeiculo(veiculo);
  const caixas = new THREE.Group();
  caixas.name = 'caixas';
  caixas.add(criarCaixa(envelopes.casco, COR_CASCO, 'caixa-casco'));
  caixas.add(criarCaixa(envelopes.torre, COR_TORRE, 'caixa-torre'));
  const cano = criarCano(veiculo.canhao);
  cano.position.set(veiculo.canhao.pivo.x, veiculo.canhao.pivo.y, veiculo.canhao.pivo.z);
  caixas.add(cano);
  group.add(caixas);

  return {
    group,
    placas,
    caixas,
    setDebugVisible(visivel: boolean) {
      placas.visible = visivel;
      modulos.visible = visivel;
      caixas.visible = !visivel;
    },
  };
}

/** Caixote chapado, com aresta escura para a silhueta ler à distância. */
export function criarCaixa(caixa: Caixa, cor: number, nome: string): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(caixa.tamanho.x, caixa.tamanho.y, caixa.tamanho.z);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: cor }));
  mesh.name = nome;
  mesh.position.copy(caixa.centro);
  mesh.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: COR_ARESTA }),
    ),
  );
  return mesh;
}

/**
 * Cilindro do pivô para a frente (+z local). A boca fica em
 * z = comprimento, que é de onde o tiro parte.
 */
export function criarCano(canhao: Canhao): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(canhao.raio, canhao.raio, canhao.comprimento, 12);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, canhao.comprimento / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: COR_CANO }));
  mesh.name = 'cano';
  return mesh;
}
