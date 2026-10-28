(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function cl(x){return x<0?0:x>1?1:x}
  function sm(a,b,x){x=cl((x-a)/(b-a));return x*x*(3-2*x)}
  function lerp(a,b,k){return a+(b-a)*k}
  function prog(el){var r=el.getBoundingClientRect(),span=r.height-innerHeight;return cl(-r.top/(span||1))}
  // cena coberta pela parte seguinte, que sobe por cima: a animação termina antes da última tela
  function progC(el){var r=el.getBoundingClientRect(),span=r.height-2*innerHeight;return cl(-r.top/(span||1))}
  function fit(c){var d=Math.min(2,window.devicePixelRatio||1),w=c.clientWidth,h=c.clientHeight;c.width=w*d;c.height=h*d;var x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);return {w:w,h:h,ctx:x}}

  // horários
  var d=new Date().getDay();
  var dd=d>=1&&d<=5?1:d;document.querySelectorAll('#hours tr').forEach(function(r){if(+r.dataset.d===dd)r.classList.add('today')});

  // pratos: abas e entrada girando
  var plates=document.querySelectorAll('.plate');
  if(!reduce){
    var pio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.remove('pre');pio.unobserve(e.target)}})},{rootMargin:'0px 0px -12% 0px'});
    plates.forEach(function(p){if(p.getBoundingClientRect().top>innerHeight){p.classList.add('pre');pio.observe(p)}});
  }
  // destaque da aba: desliza até a aba escolhida
  var tabsEl=document.querySelector('.tabs'),tabBtns=tabsEl.querySelectorAll('button'),tabInd=document.createElement('span');
  tabInd.className='tab-ind';tabInd.setAttribute('aria-hidden','true');tabsEl.prepend(tabInd);
  function moveInd(b){tabInd.style.width=b.offsetWidth+'px';tabInd.style.transform='translateX('+(b.offsetLeft-4)+'px)'}
  moveInd(tabsEl.querySelector('[aria-selected="true"]'));
  if(document.fonts)document.fonts.ready.then(function(){moveInd(tabsEl.querySelector('[aria-selected="true"]'))});
  requestAnimationFrame(function(){tabsEl.classList.add('ready')});
  addEventListener('resize',function(){moveInd(tabsEl.querySelector('[aria-selected="true"]'))});
  // troca de categoria: quem sai some, quem fica desliza para o novo lugar, quem entra aparece subindo
  var EASE='cubic-bezier(.2,.7,.2,1)',filterRun=0;
  function filterPlates(f){
    var run=++filterRun,want=function(p){return f==='all'||p.dataset.c===f};
    plates.forEach(function(p){p.getAnimations().forEach(function(a){a.cancel()})});
    if(reduce){plates.forEach(function(p){p.hidden=!want(p)});return}
    var leaving=[],staying=[],entering=[];
    plates.forEach(function(p){if(!p.hidden&&!want(p))leaving.push(p);else if(!p.hidden)staying.push(p);else if(want(p))entering.push(p)});
    var outs=leaving.map(function(p){return p.animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.94)'}],{duration:170,easing:'ease-in',fill:'forwards'}).finished});
    Promise.all(outs).then(function(){
      if(run!==filterRun)return;
      var first=new Map();staying.forEach(function(p){first.set(p,p.getBoundingClientRect())});
      plates.forEach(function(p){p.hidden=!want(p);p.getAnimations().forEach(function(a){a.cancel()})});
      staying.forEach(function(p){
        var a=first.get(p),b=p.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top;
        if(dx||dy)p.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],{duration:380,easing:EASE});
      });
      entering.forEach(function(p,i){
        p.animate([{opacity:0,transform:'translateY(14px) scale(.97)'},{opacity:1,transform:'none'}],{duration:420,delay:60*i,easing:EASE,fill:'backwards'});
      });
    }).catch(function(){});
  }
  tabBtns.forEach(function(b){b.addEventListener('click',function(){
    if(b.getAttribute('aria-selected')==='true')return;
    tabBtns.forEach(function(x){x.setAttribute('aria-selected',x===b?'true':'false')});
    moveInd(b);filterPlates(b.dataset.f);
  })});

  // frase que acende
  var rv=document.getElementById('rv'),hiWords=['sem','pressa,','café'];
  rv.innerHTML=rv.textContent.split(' ').map(function(w){return '<span'+(hiWords.indexOf(w)>-1?' class="hi"':'')+'>'+w+'</span> '}).join('');
  var rw=rv.querySelectorAll('span');
  function revealUpd(){var r=rv.getBoundingClientRect(),k=cl((innerHeight*0.85-r.top)/(r.height+innerHeight*0.35));var n=Math.round(k*rw.length);rw.forEach(function(s,i){s.classList.toggle('lit',i<n)})}

  /* ---------- página contínua ---------- */
  // faixa de itens: duplica o conteúdo para a volta ser contínua
  var mt=document.getElementById('mtrack');if(mt)mt.innerHTML+=mt.innerHTML;
  // revelação ao rolar: só marca o que ainda está abaixo da primeira tela, para nada ficar escondido sem motivo
  if(!reduce&&'IntersectionObserver' in window){
    var rio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){
      // na galeria que desliza de lado, os cartões fora da tela nunca "entram" na vista: revela todos quando a galeria aparece
      var t=e.target;(t.classList.contains('gal')?[].slice.call(t.querySelectorAll('.rv-pre')):[t]).forEach(function(x){x.classList.remove('rv-pre')});rio.unobserve(t)}})},{rootMargin:'0px 0px -10% 0px'});
    document.querySelectorAll('[data-rv]').forEach(function(el,i){
      if(el.getBoundingClientRect().top>innerHeight){el.classList.add('rv-pre');el.style.transitionDelay=(i%4)*70+'ms';rio.observe(el.closest('.gal')||el)}
    });
  }
  // cartões empilhados: o de baixo encolhe e escurece um pouco enquanto o próximo cobre
  var fcards=[].slice.call(document.querySelectorAll('.fcard')),fsec=document.getElementById('destaques'),fTops=[];
  function stackTops(){fTops=fcards.map(function(c){return parseFloat(getComputedStyle(c).top)||0})}
  stackTops();addEventListener('resize',stackTops);
  function stackUpd(){
    if(reduce||!fcards.length)return;
    var r=fsec.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;
    // lê todas as posições antes de escrever, para o navegador não recalcular o layout a cada cartão
    var ks=fcards.map(function(c,i){var nx=fcards[i+1];return nx?cl(1-(nx.getBoundingClientRect().top-fTops[i])/(innerHeight*0.8)):-1});
    fcards.forEach(function(c,i){
      var k=ks[i];if(k<0){c.style.transform='';c.style.filter='';return}
      c.style.transform='scale('+(1-0.06*k).toFixed(4)+')';c.style.filter=k>0?'brightness('+(1-0.45*k).toFixed(3)+')':'';
    });
  }


  /* ---------- bebidas ---------- */
  var drinks=[
    {n:'Espresso',d:'Café puro e intenso, servido na xícara pequena.',spec:'Cerca de 30 ml',e:.2,m:0,f:.035,ice:0,cocoa:0,bg:'--d1',tone:'dark',img:'espresso',alt:'Espresso com crema numa xícara branca de porcelana, sobre o pires'},
    {n:'Macchiato',d:'Leite, uma dose de espresso e espuma por cima, no copo de vidro.',spec:'Cerca de 200 ml',e:.2,m:.04,f:.14,ice:0,cocoa:0,bg:'--d2',tone:'dark',img:'macchiato',alt:'Copo de vidro baixo com camadas de leite e café, coberto de espuma'},
    {n:'Cappuccino',d:'Espresso, leite e bastante espuma, na taça de vidro com alça.',spec:'Cerca de 180 ml',e:.19,m:.28,f:.27,ice:0,cocoa:1,bg:'--d3',tone:'light',img:'cappuccino',alt:'Cappuccino em taça de vidro com alça, coberto de espuma'},
    {n:'Latte',d:'Uma dose de espresso com bastante leite, no copo alto.',spec:'Cerca de 240 ml',e:.17,m:.58,f:.09,ice:0,cocoa:0,bg:'--d4',tone:'light',img:'latte',alt:'Latte em copo alto de vidro, com espuma e canela por cima'},
    {n:'Gelado',d:'Espresso, leite gelado e gelo, com chantilly e calda de caramelo.',spec:'Cerca de 300 ml',e:.22,m:.5,f:0,ice:1,cocoa:0,bg:'--d5',tone:'dark',img:'gelado',alt:'Café gelado com leite e gelo num copo alto de vidro, coberto de chantilly e calda de caramelo'}
  ];
  var dsec=document.getElementById('bebidas'),dst=document.getElementById('dstage'),dwords=document.getElementById('dwords'),dchips=document.getElementById('dchips'),dbg=document.getElementById('dbg');
  var dname=document.getElementById('dname'),ddesc=document.getElementById('ddesc'),dspec=document.getElementById('dspec'),dcount=document.getElementById('dcount');
  drinks.forEach(function(k,i){
    // cada nome gigante tem a cor fixa do seu fundo: assim ele nunca precisa ser redesenhado na troca de tom
    var s=document.createElement('span');s.textContent=k.n;s.dataset.len=k.n.length;s.style.color=k.tone==='light'?'var(--ink)':'var(--fg)';dwords.appendChild(s);
    var b=document.createElement('button');b.innerHTML='<span>'+k.n+'</span>';b.addEventListener('click',function(){goDrink(i)});
    dchips.appendChild(b);
  });
  function goDrink(i){
    i=Math.max(0,Math.min(drinks.length-1,i));
    var top=dsec.getBoundingClientRect().top+scrollY,span=dsec.offsetHeight-2*innerHeight;scrollTo({top:top+span*(i/(drinks.length-1)),behavior:reduce?'auto':'smooth'});
  }
  // arrastar o dedo para o lado no palco troca de bebida (o scroll vertical continua normal)
  var tx=0,ty=0;
  dst.addEventListener('touchstart',function(e){tx=e.touches[0].clientX;ty=e.touches[0].clientY},{passive:true});
  dst.addEventListener('touchend',function(e){
    var dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
    if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.4)goDrink(dOn+(dx<0?1:-1));
  },{passive:true});
  // até onde vai o texto de baixo, para o copo não descer em cima dele
  var dinfo=document.querySelector('.dinfo'),infoRight=0,nameBottom=0;
  function measureInfo(){
    // base das letras do maior nome, medida em relação ao palco: centro da linha mais cerca de 0,38 da fonte
    var big=null,fs=0;wordEls.forEach(function(e){var f=parseFloat(e.style.fontSize)||0;if(f>fs){fs=f;big=e}});
    if(big){var r=big.getBoundingClientRect();nameBottom=r.top-dst.getBoundingClientRect().top+r.height/2+fs*0.38}
    infoRight=0;dinfo.querySelectorAll('.txt>*,.chips button').forEach(function(e){var r=e.getBoundingClientRect();if(r.right>infoRight)infoRight=r.right});lastP=-1}
  var dtxt=dinfo.querySelector('.txt'),dOnce=false,wordEls=dwords.querySelectorAll('span'),chipEls=dchips.querySelectorAll('button'),dOn=-1;
  // no computador o nome fica um pouco menor, para caber inteiro acima do copo
  function sizeWords(){var cap=innerWidth>=900?innerHeight*0.28:Math.max(260,innerHeight*0.36);wordEls.forEach(function(w){w.style.fontSize=Math.min(cap,innerWidth*0.96/(w.dataset.len*0.72))+'px'})}
  sizeWords();addEventListener('resize',sizeWords);
  var dcv=document.getElementById('dcv'),D=fit(dcv),dpos=0,dtarget=0;
  function setDrink(i){
    if(i===dOn)return;dOn=i;var k=drinks[i];
    chipEls.forEach(function(c,j){c.classList.toggle('on',j===i)});
    dcv.setAttribute('aria-label',k.alt);
    dst.dataset.tone=k.tone;
    dname.textContent=k.n;ddesc.textContent=k.d;dspec.textContent=k.spec;
    // o texto da bebida troca saindo do desfoque
    if(!reduce&&dOnce)dtxt.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});dOnce=true;dcount.textContent=(i+1)+' / '+drinks.length;measureInfo();
  }
  setDrink(0);
  // recipientes: foto recortada de cada bebida, com altura relativa entre elas
  var CUP_H=[190,235,260,290,285],SHADOW=[0.03,0,0,0,0];
  // as fotos são decodificadas uma vez, antes de aparecer, para a primeira entrada de cada copo não engasgar
  var bms=[];
  var cups=drinks.map(function(k,i){var im=new Image();im.decoding='async';im.onload=function(){
    lastP=-1;kick();if(window.createImageBitmap)createImageBitmap(im).then(function(b){bms[i]=b;lastP=-1;kick()},function(){});
  };return im});
  // as fotos dos copos esperam a abertura terminar de carregar (ou a pessoa chegar perto das bebidas), para não disputar com o topo
  function loadCups(){cups.forEach(function(im,i){if(!im.src)im.src='img/copo-'+drinks[i].img+'.webp'})}
  if(document.readyState==='complete')loadCups();else addEventListener('load',loadCups);
  if('IntersectionObserver' in window){var cio=new IntersectionObserver(function(es){if(es[0].isIntersecting){loadCups();cio.disconnect()}},{rootMargin:'50% 0px'});cio.observe(dsec)}
  function cup(c,i,s){
    var im=bms[i]||cups[i];if(!bms[i]&&(!im.complete||!im.naturalWidth))return;
    var hh=CUP_H[i]*s,ww=hh*im.width/im.height;
    c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.ellipse(0,hh*(0.5-SHADOW[i])-3*s,ww*0.42,7*s,0,0,6.283);c.fill();
    c.drawImage(im,-ww/2,-hh/2,ww,hh);
  }
  // cada bebida para um pouco no centro e depois desliza de lado até a próxima
  function slide(pos){var i=Math.floor(pos);return i+sm(0.15,0.85,pos-i)}
  var lastP=-1;
  function drinkDraw(pos){
    var p=slide(pos);if(Math.abs(p-lastP)<1e-4)return;lastP=p;
    var c=D.ctx,w=D.w,h=D.h;c.clearRect(0,0,w,h);
    // no computador o copo cresce com a altura da tela, para o palco não ficar vazio
    var s,cy;
    if(innerWidth>=900){
      // computador: copo mais baixo e um pouco menor; em telas estreitas ele para antes do texto de baixo, que fica à esquerda
      s=Math.min(w/380,h/640,1.9);var lim=infoRight<w/2-125*s?h-40:dinfo.offsetTop-16;
      // se não couber entre o nome e o texto, o copo diminui o necessário
      s=Math.max(0.7,Math.min(s,(lim-nameBottom-12)/290));cy=Math.min(h*0.6,lim-145*s);
    }else{s=Math.min(w/380,h/580,1.9);cy=h*0.49}
    var gap=Math.max(w*0.62,240*s);
    for(var j=0;j<drinks.length;j++){
      var d=j-p,ad=Math.abs(d);if(ad>1.3)continue;
      var sc=1-0.14*Math.min(1,ad);
      c.save();c.globalAlpha=1-sm(0.3,0.95,ad);c.translate(w/2+d*gap,cy+18*s*ad);c.scale(sc,sc);cup(c,j,s);c.restore();
    }
    // o nome gigante desliza mais rápido que o copo, para dar profundidade
    wordEls.forEach(function(el,j){
      var d=j-p,ad=Math.abs(d);
      el.style.opacity=ad>1.2?0:(0.95*(1-sm(0.2,1,ad))).toFixed(3);
      if(ad<=1.2)el.style.transform='translate3d('+(d*innerWidth*0.95).toFixed(1)+'px,0,0)';
    });
    // a cor do fundo passa de uma bebida para a outra junto com o deslize
    var i=Math.min(drinks.length-1,Math.floor(p)),f=p-i;
    dbg.style.backgroundColor=f<0.002||i===drinks.length-1?'var('+drinks[i].bg+')':'color-mix(in oklab,var('+drinks[i+1].bg+') '+(f*100).toFixed(1)+'%,var('+drinks[i].bg+'))';
  }

  /* ---------- laço ---------- */
  // só roda enquanto as bebidas estão na tela e há algo para mudar; o scroll, o resize e as fotos que chegam acordam o laço
  var last=0,running=false;
  function kick(){if(!running){running=true;last=performance.now();requestAnimationFrame(loop)}}
  function readAll(){dtarget=progC(dsec)*(drinks.length-1);revealUpd();stackUpd();kick()}
  addEventListener('scroll',readAll,{passive:true});
  addEventListener('resize',function(){D=fit(document.getElementById('dcv'));measureInfo();readAll()});
  readAll();dpos=dtarget;
  function onScreen(el){var r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight}
  // aproxima o valor do alvo em ~0,07 s, do mesmo jeito em qualquer taxa de quadros
  function follow(v,to,dt,tau){var d=to-v;return Math.abs(d)<1e-4?to:v+d*(1-Math.exp(-dt/tau))}
  function loop(){
    var now=performance.now(),dt=Math.min(0.1,(now-last)/1000);last=now;
    // fora da tela, as bebidas só acompanham o scroll, para chegarem já no lugar certo
    if(!onScreen(dsec)){dpos=dtarget;running=false;return}
    dpos=reduce?dtarget:follow(dpos,dtarget,dt,0.09);
    drinkDraw(dpos);setDrink(Math.round(slide(dpos)));
    if(dpos===dtarget&&Math.abs(lastP-slide(dpos))<1e-4){running=false;return}
    requestAnimationFrame(loop);
  }
})();
