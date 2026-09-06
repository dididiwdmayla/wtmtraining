# Treino de Mira

PWA de treino de mira para combate de blindados: antecipação, ponto
fraco e tracking. Roda no navegador do celular, instala como app.

## Rodar

```
npm install
npm run dev      # abre com --host, acessível pelo celular na rede
npm test         # núcleo numérico e sensibilidade da mira
```

## Estrutura

```
src/core/    balística, blindagem, pontuação. Número puro, testado.
src/render/  three.js. Consome o núcleo.
data/        munições e veículos em JSON. Todo número de jogo mora aqui.
```

As regras de arquitetura estão em `PROJETO.md`.

## Antes do primeiro push

1. `claude setup-token` e salve o resultado como secret
   `CLAUDE_CODE_OAUTH_TOKEN` no repositório.
2. Não adicione `ANTHROPIC_API_KEY`. Se os dois existirem, a chave de
   API tem precedência e a cobrança deixa de sair da assinatura.
3. Gere `public/icone-192.png` e `public/icone-512.png`.
