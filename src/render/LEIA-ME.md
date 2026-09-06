# Camada de render

O que ela pode fazer: desenhar, ouvir toque, mostrar HUD.
O que ela não pode fazer: calcular balística, penetração ou pontuação.
Isso é do núcleo, e o núcleo já está testado.

Mapa:

- `vehicle.ts` — o alvo a partir de `data/vehicles/*.json`. As placas
  seguem no grafo, invisíveis, porque é contra elas que o raycast corre;
  o que se vê são caixas (`boxes.ts`). Nada de `.glb`.
- `tank.ts` — o blindado do jogador: casco no chão, torre com guinada de
  mundo, canhão com elevação limitada. É o modelo de dois corpos.
- `camera.ts` — terceira pessoa (filha da torre) e mira (filha do
  canhão, com zoom contínuo). Nenhuma das duas participa do tiro. É
  daqui que sai o FOV que escala a sensibilidade.
- `input.ts` — joystick na metade esquerda, arraste na metade direita,
  pinça de dois dedos na direita para o zoom. Aplica a curva de ganho de
  `data/controles.json` no PRÓPRIO evento de toque e entrega radianos.
  Nenhum filtro, nenhuma suavização: a única inércia é o teto de
  velocidade da torre, no `tank.ts`.
- `shot.ts` — raycast da boca do cano contra as placas e chamada ao
  núcleo. É o único lugar que fala com `resolverImpacto`.
- `audio.ts` — buffer do disparo decodificado uma vez, no carregamento.
  Cada tiro é só um `BufferSource`; `new Audio()` por tiro atrasa.
- `flash.ts` — clarão de boca, numa camada que só a câmera de terceira
  pessoa renderiza: na mira a câmera nasce dentro do cano e a labareda
  cobriria a retícula. Lá o clarão é o de tela, no `hud.ts`.
- `hud.ts`, `decals.ts`, `scene.ts`, `sky.ts`, `color.ts` — tela.

Botão só existe se existir no jogo. As exceções são a alternância de
câmera e o toggle de debug dos módulos. O zoom, por isso, é pinça — não
um par de botões.

Próximo passo: marcação de lead em mrad na retícula e o alvo em
movimento, que é onde `solucaoDeTiro` entra.
