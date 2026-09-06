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
- `sensibilidade.ts` — a conta da mira, em número puro e testada:
  fração de tela percorrida vezes o FOV DAQUELE eixo. O eixo X usa o FOV
  horizontal, que sai do vertical com a razão de aspecto; o Y usa o
  vertical. É isso que faz o mesmo deslocamento angular do dedo girar o
  mesmo tanto em retrato e em paisagem. Sem `devicePixelRatio`: o toque
  já chega em pixel CSS e a tela é medida na mesma unidade.
- `input.ts` — joystick na metade esquerda, arraste na metade direita,
  pinça de dois dedos na direita para o zoom. Roteia por `pointerId`, um
  papel por dedo, e chama `sensibilidade.ts` no PRÓPRIO evento de toque.
  O ângulo sai do DESLOCAMENTO, não da velocidade, então o total de um
  gesto é o mesmo a 30, 60 ou 120 Hz. Nenhum filtro, nenhuma suavização:
  a única inércia é o teto de velocidade da torre, no `tank.ts`.
- `ajustes.ts` — painel vivo com os três deslizadores: sensibilidade
  base, intensidade da curva de ganho e sensibilidade no zoom máximo. Os
  padrões vêm de `data/controles.json`, o que o jogador mexer fica em
  `localStorage`, e o input lê o valor no evento seguinte — sem
  recarregar.
- `tela.ts` — a medida da área visível e a tela cheia. `innerHeight` não
  serve no celular: com a barra de endereço na tela ele conta o que está
  atrás dela. Canvas, câmeras, retícula e input saem todos daqui, senão
  o cano aponta para um pixel e a retícula desenha em outro.
- `shot.ts` — raycast da boca do cano contra as placas e chamada ao
  núcleo. É o único lugar que fala com `resolverImpacto`.
- `audio.ts` — um buffer por munição, decodificado uma vez no
  carregamento. Cada tiro é só um `BufferSource`; `new Audio()` por tiro
  atrasa.
- `flash.ts` — clarão de boca, numa camada que só a câmera de terceira
  pessoa renderiza: na mira a câmera nasce dentro do cano e a labareda
  cobriria a retícula. Lá o clarão é o de tela, no `hud.ts`.
- `hud.ts`, `decals.ts`, `scene.ts`, `sky.ts`, `color.ts` — tela.

Botão só existe se existir no jogo. As exceções são instrumento de
treino, não interface de combate: alternância de câmera, toggle de debug
dos módulos, troca de munição, painel de ajustes e tela cheia. O zoom,
por isso, continua sendo pinça — não um par de botões.

A troca de munição lê `data/ammo/` inteiro. Nada na render sabe quanto
tempo um projétil voa: `shot.ts` pergunta ao núcleo (`tempoDeVoo`) e
integra a trajetória com `avancarProjetil`, então o traçante do míssil é
lento porque o JSON diz que ele é lento — 2,86 s contra 0,64 s da flecha
a 1000 m.

Próximo passo: marcação de lead em mrad na retícula e o alvo em
movimento, que é onde `solucaoDeTiro` entra.
