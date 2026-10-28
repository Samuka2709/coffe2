# Site de cafeteria com animação no scroll

> **Versão de teste:** nesta cópia, a abertura com os grãos 3D foi trocada pela animação do copo (`js/copo.js` e a pasta `frames/`). Um vídeo gerado no Google Flow foi cortado em quadros WebP (576 para computador, em 1920 × 1080, e 288 para celular, em 720 × 1080) e é desenhado num canvas conforme o scroll: o copo fica parado enquanto o título sai e as palavras Café, Doces, Salgados e Almoço vão até os grãos; depois a tampa sobe, o café é servido, a câmera entra no copo e, sobre a espuma, aparece "Tirado na hora, do jeito que você prefere." O topo do site fica dentro do palco da animação. Os quadros só começam a baixar depois que a página carrega (o primeiro vem antes), em etapas, no máximo 6 por vez. Os arquivos ficam guardados comprimidos (cerca de 20 MB no computador e 6 MB no celular), e só os quadros perto da posição atual ficam abertos para desenhar (no máximo 18 no computador e 24 no celular); guardar todos abertos passaria de 4 GB e travava o navegador. O canvas não passa da resolução do vídeo na tela. O conjunto (celular abaixo de 768 px de largura, computador acima) é escolhido ao abrir a página e trocado se a largura passar desse limite depois (celular girado, janela redimensionada): os quadros novos baixam a partir do ponto em que o vídeo está, e o conjunto anterior fica na tela até eles chegarem. Textos, tempos e posições ficam no objeto `CONFIG` no começo de `js/copo.js`. A abertura ocupa 4,5 telas de rolagem no computador e 3,1 no celular (`.cup` com 550svh e 410svh). O resto da página não mudou; de `js/main.js` e do CSS saiu o código dos grãos 3D e do hero antigo, que esta versão não usa, e o laço das bebidas só roda enquanto elas estão na tela e se mexendo.

Protótipo feito no chat do Claude, continuado no Claude Code. Sem bibliotecas externas; a única dependência são as fontes do Google Fonts.

## Estrutura

- `index.html`: a página inicial.
- `cardapio.html`: o cardápio completo, leve (sem as animações da inicial), bom para QR code na mesa. Pelo menu "Imprimir" do navegador, sai em fundo branco e duas colunas.
- `papelaria.html`: os produtos da papelaria, por categoria, com foto, descrição e preço de exemplo, e botão de WhatsApp para reservar.
- `css/style.css`: todo o CSS.
- `js/main.js`: o JavaScript da inicial, carregado com `defer`.
- `js/pagina.js`: o JavaScript das páginas internas (revelação ao rolar e categoria ativa na barra de categorias presa no topo).
- `img/`: imagens do site, em WebP. `img/copo-*.webp` são os recipientes recortados das bebidas.
- `originais/`: fotos e vídeos originais, fora do site publicado. `originais/CREDITOS.md` lista a origem e a licença de cada um.

## Regras do projeto

- A marca é genérica ("Café"). Não usar nome, logo, fotos, endereço, horários ou contatos de nenhuma cafeteria real, porque não há permissão para isso.
- As referências (sites e vídeos) servem só de inspiração nos detalhes. Nada deve ser copiado.
- Texto sóbrio e sem emojis.
- O site precisa funcionar bem no celular, que é onde a maioria vai acessar.
- Respeitar `prefers-reduced-motion`: com movimento reduzido, as animações ficam paradas ou seguem o scroll sem suavização.

## Visual

- Página contínua, inspirada nos vídeos de referência e no farmminerals.com: fundo escuro do começo ao fim, sem linhas separando as partes, com brilhos quentes suaves e blocos que aparecem com um leve desfoque ao entrar na tela.
- Tema escuro de cafeteria à noite: fundo `#120e0c`, texto `#f4ece4`, destaque laranja `#ff7a1a`.
- Fontes: Instrument Serif nos títulos, com palavras em itálico laranja; Archivo largo e pesado nos nomes gigantes das bebidas; Figtree no texto corrido.
- As cores ficam todas em variáveis CSS no `:root`.

## Transições

- **Cobertura:** a frase que acende sobe por cima do palco das bebidas, que fica parado enquanto ela cobre (borda reta; a borda ondulada foi testada e retirada).
- **Cena coberta:** as bebidas terminam a animação uma tela antes do fim (`progC`), e essa última tela é o tempo da frase subir por cima.
- **Deslize das bebidas:** cada bebida para um pouco no centro e depois desliza de lado até a próxima, presa ao scroll. O nome gigante desliza mais rápido que o copo (profundidade), e a cor de fundo passa de uma bebida para a outra no mesmo ritmo. No celular, arrastar o dedo para o lado no palco também troca de bebida.
- **Desfoque:** o texto das bebidas entra saindo do desfoque; os títulos das partes aparecem saindo do desfoque ao entrar na tela.

## Seções, em ordem

1. **Abertura com o copo** (`#inicio`, palco fixo, canvas `#cupcv`): o vídeo em quadros conduzido pelo scroll, descrito na nota do começo deste arquivo. Começa com o título, o texto e os botões sobre o copo; termina com o texto final sobre a espuma e a base do palco se fundindo ao fundo da página. Uma linha fina na base do palco (`#cload`) mostra o carregamento dos quadros.
2. **Topo:** fica dentro do palco da abertura (`.ctop`), com o nome "Café" e links para Bebidas, Cardápio, Papelaria, Visite e Contato (no celular aparecem Cardápio, Papelaria e Contato). Texto escuro sobre o fundo caramelo do começo e claro no fim, quando o café escurece.
3. **Faixa de itens:** nomes do cardápio em itálico passando na horizontal.
4. **Bebidas** (`#bebidas`, palco fixo, canvas `#dcv`): Espresso, Macchiato, Cappuccino, Latte e Gelado, cada um com o recipiente real recortado (`img/copo-*.webp`), o nome gigante atrás e cor de fundo própria. O topo do palco se funde ao fundo da página.
5. **Frase que acende:** palavra por palavra durante o scroll, sobre a foto do ambiente escurecida.
6. **Cardápio em lista** (`#pratos`): cartões com foto pequena redonda, categoria, nome e descrição, com abas animadas (Tudo, Doces, Salgados, Almoço).
7. **Destaques** (`#destaques`): três pratos em cartões que se empilham; o de baixo encolhe e escurece enquanto o próximo cobre.
8. **Resumo do cardápio** (`#cardapio`): o grupo dos cafés e o botão "Ver cardápio completo", que leva a `cardapio.html`.
9. **Cantos da casa** (`#cantos`): galeria de cartões altos que desliza de lado.
10. **Resumo da papelaria** (`#papelaria`): quatro fotos e o botão "Ver papelaria", que leva a `papelaria.html`.
11. **Eventos:** dois cards de exemplo.
12. **Visite** (`#visite`, escuro): horários com destaque para hoje, endereço e botões de exemplo, ao lado de uma foto.
13. **Rodapé:** links e o nome "Café" bem grande.

## Fotos

Todas as fotos são ilustrativas, de banco de imagens (Pexels), e devem ser trocadas pelas fotos da casa. Cada uma tem duas larguras (`srcset`), texto alternativo e `loading="lazy"`:

- **Pratos** (`.disc img`): `img/prato-*-480.webp` e `-960.webp`, quadradas.
- **Cantos** (`.gcard img`, galeria) e **Visite** (`.vimg img`): `img/canto-*-800.webp` e `-1600.webp`.
- **Fundo da frase que acende** (`.reveal .bgimg`): `img/fundo-ambiente-960.webp` (vertical, celular) e `-1920.webp` (horizontal, computador).

Para trocar uma foto, gere os mesmos arquivos com os mesmos nomes e tamanhos.

## Qualidade (revisão de 28/10/2026)

- As três páginas têm descrição, prévia de compartilhamento (`og:`), cor do navegador, ícone (`img/icone.svg`) e um atalho "Pular para o conteúdo" que aparece ao navegar pelo teclado.
- Contraste conferido em cada bebida: texto pequeno com pelo menos 4,5:1 e títulos com pelo menos 3:1. O fundo do Gelado (`--d5`) ficou mais escuro por isso.
- Links do menu e do rodapé com área de toque de pelo menos 44 px de altura.
- No cardápio, os nomes das categorias são `h2` (antes pulavam do `h1` para o `h3`).
- Fotos dos copos no tamanho em que aparecem (820 px de altura): de 400 KB para 187 KB. Textura dos grãos recomprimida (de 142 KB para 112 KB), mantendo 1024 × 512 por causa do WebGL.
- Testado em 320, 390, 768 e 1280 px nas três páginas, sem rolagem para o lado.
- Prévia de compartilhamento com imagem (`img/compartilhar.jpg`, 1200 × 630) e endereço canônico apontando para https://coffe2-tau.vercel.app. Se o site ganhar domínio próprio, trocar esse endereço nas três páginas.

## Publicação

- Código no GitHub: https://github.com/Samuka2709/coffe2 (esta versão de teste; o site principal fica em https://github.com/Samuka2709/Coffee, publicado em https://coffee-one-delta-90.vercel.app; a pasta `originais/` fica fora, só `CREDITOS.md` vai junto).
- Site na Vercel: https://coffe2-tau.vercel.app. Cada envio para a branch `main` atualiza o site sozinho.
- `vercel.json` guarda as imagens de `img/` e os quadros de `frames/` no navegador por 7 dias. Ao trocar uma foto, use um nome de arquivo novo (por exemplo, `copo-latte-2.webp`); com o mesmo nome, quem já visitou pode ver a foto antiga por até uma semana. CSS e JS são conferidos a cada visita.
- Fontes: só os pesos usados (Archivo 900 a 110% de largura, só na inicial; Figtree 400 e 600; Instrument Serif normal e itálico).
- As fotos dos copos começam a baixar depois que a abertura termina de carregar, ou quando a pessoa chega perto das bebidas.

## Próximos passos

- Trocar as fotos e vídeos de banco pelos da casa, quando houver permissão.
- Trocar o cardápio e a papelaria de exemplo (itens, fotos e preços), nomes de pratos, descrições, horários, endereço e contatos pelos dados reais do cliente que tiver permissão.
- Testar no celular: desempenho dos canvas (grãos 3D e copo) e se os balões ficam legíveis por cima do copo.
- Versão para ver no celular publicada como página privada no claude.ai; para atualizar, publicar de novo o mesmo `index.html`.
