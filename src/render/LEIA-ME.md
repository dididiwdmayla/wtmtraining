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
  canhão). Nenhuma das duas participa do tiro.
- `input.ts` — joystick na metade esquerda, arraste na metade direita.
  Entrega delta; quem vira ângulo é o `tank.ts`.
- `shot.ts` — raycast da boca do cano contra as placas e chamada ao
  núcleo. É o único lugar que fala com `resolverImpacto`.
- `hud.ts`, `decals.ts`, `scene.ts`, `sky.ts`, `color.ts` — tela.

Próximo passo: marcação de lead em mrad na retícula e o alvo em
movimento, que é onde `solucaoDeTiro` entra.
