import * as THREE from 'three';
import { resolverImpacto } from '../core/index.js';
import type { Ammo, ResultadoImpacto, Veiculo } from '../core/index.js';

export interface ImpactoDetectado {
  resultado: ResultadoImpacto;
  pontoMundo: THREE.Vector3;
  mesh: THREE.Object3D;
}

/** Acima disto o gesto foi órbita (arrastar a câmera), não um toque. */
const LIMIAR_ARRASTO_PX = 8;

/**
 * Um toque na tela dispara um raycast a partir da câmera contra as
 * placas do veículo. A resolução do impacto é toda do núcleo — aqui só
 * convertemos coordenadas de tela em placa + ponto + direção, em
 * espaço local do veículo.
 */
export function attachToqueDeTiro(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  alvoGroup: THREE.Object3D,
  veiculo: Veiculo,
  municao: Ammo,
  onImpacto: (impacto: ImpactoDetectado) => void,
): void {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const dom = renderer.domElement;
  let inicio: { x: number; y: number } | null = null;

  dom.addEventListener('pointerdown', (ev) => {
    inicio = { x: ev.clientX, y: ev.clientY };
  });

  dom.addEventListener('pointerup', (ev) => {
    const partiu = inicio;
    inicio = null;
    if (!partiu) return;
    if (Math.hypot(ev.clientX - partiu.x, ev.clientY - partiu.y) > LIMIAR_ARRASTO_PX) return;

    const rect = dom.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);

    const acertos = raycaster.intersectObject(alvoGroup, true);
    if (acertos.length === 0) return;
    const acerto = acertos[0];
    const placa = veiculo.placas.find((p) => p.id === acerto.object.name);
    if (!placa) return;

    const pontoLocal = alvoGroup.worldToLocal(acerto.point.clone());
    const inversaRotacao = alvoGroup.getWorldQuaternion(new THREE.Quaternion()).invert();
    const direcaoLocal = acerto.point
      .clone()
      .sub(camera.position)
      .normalize()
      .applyQuaternion(inversaRotacao);
    const distancia = camera.position.distanceTo(acerto.point);

    const resultado = resolverImpacto(
      placa,
      { x: pontoLocal.x, y: pontoLocal.y, z: pontoLocal.z },
      { x: direcaoLocal.x, y: direcaoLocal.y, z: direcaoLocal.z },
      distancia,
      municao,
      veiculo,
    );

    onImpacto({ resultado, pontoMundo: acerto.point.clone(), mesh: acerto.object });
  });
}
