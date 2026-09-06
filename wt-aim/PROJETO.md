# Treino de Mira — regras do projeto

Fonte única de verdade para qualquer agente que trabalhe neste repositório.
`CLAUDE.md` e `AGENTS.md` apontam para cá. Não duplique regra nos dois.

## O que é

PWA de treino de mira para combate de blindados. Não é um jogo, é um
aparelho de medição. O objetivo é que o jogador melhore em três coisas:

1. **Antecipação (lead)** — alvo cruzando, com o atirador parado ou em
   movimento. A velocidade que gera antecipação é a **relativa**.
2. **Ponto fraco** — a hitbox é grande, a área que importa é pequena. O
   acerto vale pelo módulo atingido, nunca por "acertou o tanque".
3. **Tracking** — manter a retícula no alvo durante o voo de um míssil
   guiado, com os dois em movimento.

## A regra que não se quebra

O erro do jogador é medido em **milirradianos, decomposto em horizontal
e vertical**, nunca em pixels. Pixel depende de FOV, de zoom e de tela;
mrad é a mesma unidade em qualquer aparelho e é comparável entre sessões.

O estabilizador segura o eixo vertical. Logo, o erro que ensina alguma
coisa é o **horizontal**. Qualquer tela de resultado que junte os dois
num número só está destruindo a informação principal.

## Arquitetura em três camadas

```
src/core/     números puros. Zero three.js, zero DOM.
src/render/   three.js. Consome o núcleo, nunca calcula regra.
data/         JSON de munições e veículos. Nenhum número no código.
```

Regras duras:

- `src/core` **não pode importar** de `src/render`, de `three` nem tocar
  em `window`/`document`. Se precisar, a modelagem está errada.
- Nenhuma constante de balística, penetração ou blindagem no código.
  Tudo vem de `data/`. Ajuste fino é edição de JSON, não refactor.
- `src/core/types.ts` é o contrato congelado. Mudança ali exige mudança
  deliberada, com os testes atualizados na mesma alteração.

## Geometria e hitbox são o mesmo arquivo

O veículo nasce de `data/vehicles/*.json`. As mesmas placas que a render
desenha são as que o núcleo usa para calcular espessura efetiva. **Não
introduza modelo `.glb` nem malha externa.** Duas fontes de verdade
desalinham em silêncio e o treino passa a ensinar a coisa errada.

Sem textura fotográfica. Cor chapada e luz direcional leem inclinação de
blindagem melhor que realismo.

## Unidades

| grandeza    | unidade                        |
|-------------|--------------------------------|
| distância   | metros                         |
| velocidade  | m/s                            |
| ângulo      | graus (JSON e entrada humana)  |
| erro/lead   | mrad (1 mrad = 1 m a 1000 m)   |
| espessura   | mm                             |
| tempo       | segundos                       |

## Testes

`npm test` precisa passar antes de qualquer PR. O núcleo é verificável
por teste; use isso. Mudou fórmula, o teste muda junto e o motivo vai na
mensagem do commit.

Os testes de `solucaoDeTiro` sobre movimento do atirador são os mais
importantes do repositório. Se um deles quebrar, pare e investigue em vez
de ajustar o valor esperado.

## Fora de escopo

- Extrair asset, modelo, som, HUD ou tabela de qualquer jogo comercial.
  Valores próprios e consistentes treinam o mesmo reflexo e o projeto
  não envelhece a cada patch.
- Multiplayer, conta, login, backend.
- Terreno procedural, clima, ciclo de dia.

## Divisão de trabalho entre agentes

Um agente por camada, cada um no seu branch. O contrato em `types.ts` é
o que impede que um quebre o outro.

- **núcleo**: `src/core`, `data`, testes.
- **render**: `src/render`, HUD, entrada por toque, PWA.

Quem mexe no núcleo não mexe na render, e vice-versa. Se uma tarefa
precisa das duas, ela é duas tarefas e o contrato entra primeiro.
