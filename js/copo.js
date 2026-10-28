/* Abertura com o copo: um vídeo cortado em quadros (frames/) desenhado num canvas, conduzido pelo scroll.
   Tudo é calculado a partir de p (0 a 1 = quanto da seção já foi rolado), então ao rolar para cima tudo volta. */
(function(){
  var CONFIG={
    desktop:{pasta:'frames/desktop/',total:576,w:1920,h:1080},
    mobile:{pasta:'frames/mobile/',total:288,w:720,h:1080},
    larguraMobile:768,
    // o vídeo fica parado no começo (os textos saem) e no fim (o texto final aparece)
    inicioVideo:0.08,fimVideo:0.92,
    fases:{
      textoSai:[0,0.06],      // título, texto e botões sobem e somem
      etiquetasVao:[0.005,0.06], // as quatro palavras vão até os grãos
      etiquetasSomem:[0.085,0.13],
      sombra:[0.8,0.9],        // escurece o café para o texto final
      tomEscuro:0.84,          // menu passa para texto claro
      textoFinal:[0.84,0.93],
      zoom:[0.85,1],zoomMax:1.12,
      fundo:[0.93,1]           // a base do palco se funde ao fundo escuro da página
    },
    // grãos do primeiro quadro, em fração do vídeo (computador); lado = de que lado do grão fica a palavra
    etiquetas:[{x:0.303,y:0.635,lado:'esq'},{x:0.363,y:0.557,lado:'esq'},{x:0.693,y:0.554,lado:'dir'},{x:0.688,y:0.767,lado:'dir'}],
    // tempo (em segundos) que o vídeo leva para alcançar o scroll: maior = mais macio
    suavizar:0.11
  };

  var sec=document.getElementById('inicio');if(!sec)return;
  var stage=document.getElementById('cstage'),cv=document.getElementById('cupcv'),ctx=cv.getContext('2d',{alpha:false});
  var hero=document.getElementById('chero'),tags=[].slice.call(document.querySelectorAll('#ctags li')),fin=document.getElementById('cfinal');
  var shade=document.getElementById('cshade'),glow=document.getElementById('cglow'),fade=document.getElementById('cfade'),hint=document.getElementById('cscroll');
  var bar=document.getElementById('cbar'),barWrap=document.getElementById('cload');
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  function cl(x){return x<0?0:x>1?1:x}
  function sm(a,b,x){x=cl((x-a)/(b-a));return x*x*(3-2*x)}

  // Memória: os quadros ficam guardados comprimidos (cerca de 20 MB no computador, 6 MB no celular) e só os que
  // estão perto da posição atual são decodificados (cada quadro aberto ocupa 8 MB no computador). Guardar todos
  // abertos passaria de 4 GB e trava ou derruba o navegador.
  //
  // Qual conjunto: o de celular abaixo de larguraMobile, o de computador acima. Se a largura passar desse limite
  // depois (celular girado, janela redimensionada), o conjunto é trocado; o anterior continua na tela até os
  // quadros novos chegarem.
  var conn=navigator.connection||{},slow=conn.saveData||/(^|-)(2g|3g)$/.test(conn.effectiveType||'');
  var mobile,SET,N,blobs,ok,loadedCount,wanted,queue,seen,gen=0,prev=null;
  var active=0,MAX=6;
  var bmp=new Map(),pending={},BMAX=18,centro=0;
  function src(i){return SET.pasta+'frame_'+String(i+1).padStart(4,'0')+'.webp'}
  function push(i){if(i>=0&&i<N&&!seen[i]){seen[i]=1;queue.push(i)}}
  function drop(m){m.forEach(function(b){if(b.close)b.close()});m.clear()}

  // ordem de carregamento: o quadro da posição atual (de início, o quadro 1) e seus vizinhos,
  // depois 1 a cada 8, 1 a cada 2 e o resto (ou só 1 a cada 3 em conexão lenta)
  function useSet(m,v){
    if(prev)drop(prev.bmp);
    prev=bmp.size?{bmp:bmp,N:N}:null;bmp=new Map();
    mobile=m;SET=m?CONFIG.mobile:CONFIG.desktop;N=SET.total;gen++;
    blobs=new Array(N);ok=new Uint8Array(N);loadedCount=0;queue=[];seen=new Uint8Array(N);
    pending={};BMAX=m?24:18;
    var c=Math.round(v*(N-1));push(c);for(var d=1;d<=4;d++){push(c+d);push(c-d)}
    push(0);for(var i=0;i<N;i+=8)push(i);push(N-1);
    if(slow){for(i=0;i<N;i+=3)push(i)}else{for(i=0;i<N;i+=2)push(i);for(i=1;i<N;i+=2)push(i)}
    wanted=queue.length;centro=c;lastKey='';needDraw=true;
    barWrap.classList.remove('done');updBar();
  }

  // baixa o arquivo comprimido; abre logo só se estiver perto do que está na tela
  function loadOne(i,done){
    var g=gen;
    fetch(src(i)).then(function(r){if(!r.ok)throw r.status;return r.blob()}).then(function(b){
      // quadro de um conjunto que já foi trocado: descartado
      if(g!==gen){done();return}
      blobs[i]=b;ok[i]=1;loadedCount++;
      if(Math.abs(i-centro)<=10)want(i);
      updBar();done();
    },function(){if(g===gen){loadedCount++;updBar()}done()});
  }
  function pump(){
    while(active<MAX&&queue.length){active++;loadOne(queue.shift(),function(){active--;pump()})}
  }
  function updBar(){
    var k=loadedCount/wanted;bar.style.transform='scaleX('+k.toFixed(3)+')';
    if(k>=1)barWrap.classList.add('done');
  }

  // abre um quadro (fora da linha principal quando o navegador permite)
  function openFrame(b){
    if(window.createImageBitmap)return createImageBitmap(b);
    return new Promise(function(res,rej){var u=URL.createObjectURL(b),im=new Image();
      im.onload=function(){URL.revokeObjectURL(u);res(im)};im.onerror=function(){URL.revokeObjectURL(u);rej()};im.src=u});
  }
  function want(i){
    if(i<0||i>=N||!ok[i]||bmp.has(i)||pending[i])return;
    var g=gen;pending[i]=1;
    openFrame(blobs[i]).then(function(b){
      if(g!==gen){if(b.close)b.close();return}
      delete pending[i];bmp.set(i,b);trim();
      // só redesenha se o quadro que abriu está perto do que está na tela
      if(Math.abs(i-centro)<=2||lastKey===''){needDraw=true;kick()}
    },function(){if(g===gen)delete pending[i]});
  }
  // só uns poucos quadros ficam abertos; os mais distantes da posição atual são fechados
  function trim(){
    if(bmp.size<=BMAX)return;
    var ks=[];bmp.forEach(function(_,k){ks.push(k)});
    ks.sort(function(a,b){return Math.abs(b-centro)-Math.abs(a-centro)});
    while(bmp.size>BMAX){var k=ks.shift();var b=bmp.get(k);if(b&&b.close)b.close();bmp.delete(k)}
  }
  function prefetch(f,dir){
    centro=Math.round(f);
    for(var d=0;d<=10;d++)want(centro+(dir>=0?d:-d));
    for(d=1;d<=3;d++)want(centro+(dir>=0?-d:d));
  }
  function dims(o){return [o.naturalWidth||o.width,o.naturalHeight||o.height]}

  // quadro aberto mais próximo do pedido (no conjunto atual ou, com m, no anterior)
  function nearest(i,m,n){
    m=m||bmp;n=n||N;
    if(m.has(i))return i;
    for(var d=1;d<n;d++){if(i-d>=0&&m.has(i-d))return i-d;if(i+d<n&&m.has(i+d))return i+d}
    return -1;
  }

  // o primeiro quadro vem já (está em preload); os outros só depois que a página terminou de carregar
  useSet(innerWidth<CONFIG.larguraMobile,0);
  active++;loadOne(queue.shift(),function(){active--});
  if(document.readyState==='complete')pump();else addEventListener('load',pump);

  // tamanho do canvas: acompanha a densidade da tela (até 2x no computador e 1,5x no celular), mas não passa
  // da resolução do vídeo na tela, porque pixels a mais não deixam a imagem mais nítida e pesam a cada quadro
  var W=0,H=0,DPR=1;
  function size(){
    W=stage.clientWidth;H=stage.clientHeight;
    var s=Math.max(W/SET.w,H/SET.h);
    DPR=Math.min(mobile?1.5:2,window.devicePixelRatio||1,Math.max(1,CONFIG.fases.zoomMax/s));
    cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);ctx.imageSmoothingQuality='high';
    measureTags();needDraw=true;
  }

  // posição de um ponto do vídeo na tela, no modo "cover"
  function toScreen(fx,fy){
    var s=Math.max(W/CONFIG.desktop.w,H/CONFIG.desktop.h),dw=CONFIG.desktop.w*s,dh=CONFIG.desktop.h*s;
    return {x:(W-dw)/2+fx*dw,y:(H-dh)/2+fy*dh};
  }

  // etiquetas: medem onde estão paradas (abaixo dos botões) e para onde vão (ao lado de cada grão)
  var tagMove=[];
  function measureTags(){
    tags.forEach(function(t){t.style.transform='';t.classList.remove('esq','dir')});
    var sr=stage.getBoundingClientRect();
    tagMove=tags.map(function(t,i){
      var r=t.getBoundingClientRect(),e=CONFIG.etiquetas[i];
      if(mobile||!e)return null;
      var b=toScreen(e.x,e.y),gap=26+18,tx=e.lado==='esq'?b.x-gap-r.width:b.x+gap;
      // se a palavra sairia da tela (tela estreita), ela só some junto com o título
      if(tx<16||tx+r.width>W-16)return null;
      return {dx:tx-(r.left-sr.left),dy:b.y-(r.top-sr.top)-r.height/2,lado:e.lado};
    });
  }

  // progresso da seção
  function prog(){var r=sec.getBoundingClientRect(),span=r.height-innerHeight;return cl(-r.top/(span||1))}

  var target=0,cur=0,needDraw=true,lastKey='',running=false,visible=true,tone='light',lastT=0;
  // quanto do vídeo já passou (0 a 1) e o quadro correspondente no conjunto atual
  function vid(p){return cl((p-CONFIG.inicioVideo)/(CONFIG.fimVideo-CONFIG.inicioVideo))}
  function frameFor(p){return vid(p)*(N-1)}

  function paint(o,z,alpha){
    var d=dims(o),s=Math.max(W/d[0],H/d[1])*z,dw=d[0]*s,dh=d[1]*s;
    ctx.globalAlpha=alpha;ctx.drawImage(o,(W-dw)/2,(H-dh)/2,dw,dh);
  }
  // entre dois quadros, o seguinte aparece por cima com transparência: o movimento fica contínuo mesmo com scroll lento
  function draw(p,dir){
    var F=CONFIG.fases,f=frameFor(p),a=Math.floor(f),b=Math.min(N-1,a+1),t=f-a;
    var z=1+(F.zoomMax-1)*sm(F.zoom[0],F.zoom[1],p);
    prefetch(f,dir);
    var blend=!reduce&&bmp.has(a)&&bmp.has(b)&&b!==a&&t>0.03&&t<0.97;
    var base=blend?a:nearest(Math.round(f));
    if(base<0){
      // conjunto recém-trocado ainda sem quadros: segue com o anterior, no mesmo ponto do vídeo
      var pi=prev?nearest(Math.round(vid(p)*(prev.N-1)),prev.bmp,prev.N):-1;
      if(pi<0)return;
      var pk='p'+pi+'|'+z.toFixed(4)+'|'+W+'x'+H;
      if(pk===lastKey&&!needDraw)return;
      paint(prev.bmp.get(pi),z,1);lastKey=pk;needDraw=false;return;
    }
    // o conjunto novo já tem quadro na tela: o anterior pode ser fechado
    if(prev){drop(prev.bmp);prev=null}
    var key=base+'|'+(blend?Math.round(t*24):0)+'|'+z.toFixed(4)+'|'+W+'x'+H;
    if(key===lastKey&&!needDraw)return;
    paint(bmp.get(base),z,1);
    if(blend)paint(bmp.get(b),z,Math.round(t*24)/24);
    ctx.globalAlpha=1;lastKey=key;needDraw=false;
  }

  function texts(p){
    var F=CONFIG.fases,k=sm(F.textoSai[0],F.textoSai[1],p),mv=reduce?0:1;
    hero.style.opacity=(1-k).toFixed(3);
    hero.style.transform=k>0&&mv?'translate3d(0,'+(-30*k).toFixed(1)+'px,0)':'';
    hero.style.visibility=k>=1?'hidden':'';
    glow.style.opacity=(1-k).toFixed(3);
    hint.style.opacity=(1-sm(0,0.03,p)).toFixed(3);
    var g=sm(F.etiquetasVao[0],F.etiquetasVao[1],p),out=sm(F.etiquetasSomem[0],F.etiquetasSomem[1],p);
    tags.forEach(function(t,i){
      var m=tagMove[i];
      if(!m){t.style.opacity=(1-k).toFixed(3);t.style.transform=k>0&&mv?'translate3d(0,'+(-30*k).toFixed(1)+'px,0)':'';return}
      var gg=reduce?(g>0.5?1:0):g;
      t.style.transform='translate3d('+(m.dx*gg).toFixed(1)+'px,'+(m.dy*gg).toFixed(1)+'px,0)';
      t.style.opacity=(1-out).toFixed(3);
      t.classList.toggle(m.lado,gg>0.6);
    });
    shade.style.opacity=sm(F.sombra[0],F.sombra[1],p).toFixed(3);
    var f=sm(F.textoFinal[0],F.textoFinal[1],p);
    fin.style.opacity=f.toFixed(3);
    fin.style.transform=mv&&f<1?'translate3d(0,'+(30*(1-f)).toFixed(1)+'px,0)':'';
    fin.style.visibility=f<=0?'hidden':'visible';
    fade.style.opacity=sm(F.fundo[0],F.fundo[1],p).toFixed(3);
    var tn=p>F.tomEscuro?'dark':'light';if(tn!==tone){tone=tn;stage.dataset.tone=tn}
  }

  function tick(now){
    if(!running)return;
    var dt=lastT?Math.min(0.1,(now-lastT)/1000):1/60;lastT=now;
    var dir=target-cur;
    // aproxima do scroll do mesmo jeito em qualquer taxa de quadros da tela (60, 120 ou 144 Hz)
    cur=reduce?target:cur+(target-cur)*(1-Math.exp(-dt/CONFIG.suavizar));
    if(Math.abs(target-cur)<0.0002)cur=target;
    draw(cur,dir);texts(cur);
    // para o laço quando chegou ao alvo e não há quadro novo para desenhar
    if(cur===target&&!needDraw){running=false;lastT=0;return}
    requestAnimationFrame(tick);
  }
  function kick(){if(!running&&visible){running=true;requestAnimationFrame(tick)}}

  addEventListener('scroll',function(){target=prog();kick()},{passive:true});
  var swT=0;
  addEventListener('resize',function(){
    size();target=prog();kick();
    // a troca de conjunto espera a largura parar de mudar, para não baixar os dois enquanto a janela é arrastada
    clearTimeout(swT);swT=setTimeout(function(){
      var m=innerWidth<CONFIG.larguraMobile;if(m===mobile)return;
      useSet(m,vid(cur));size();kick();
      if(document.readyState==='complete')pump();
    },250);
  });
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){visible=es[0].isIntersecting;if(visible){needDraw=true;kick()}else running=false}).observe(stage);
  }
  if(document.fonts)document.fonts.ready.then(function(){measureTags();needDraw=true;kick()});

  size();target=cur=prog();texts(cur);kick();
})();
