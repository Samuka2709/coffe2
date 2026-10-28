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

  /* ---------- grãos flutuando ---------- */
  // na versão de teste com o copo, a abertura não tem o canvas dos grãos: tudo abaixo ignora os grãos quando #beans não existe
  var bc=document.getElementById('beans'),beans=[];
  // poucos grãos vagando pela tela em caminhos aleatórios, girando nos três eixos e desviando do texto
  function spin(lo,hi){return (Math.random()<.5?-1:1)*(lo+Math.random()*(hi-lo))}
  for(var i=0;i<9;i++){beans.push({x:-1,y:-1,z:0.55+Math.random()*0.45,ph:Math.random()*6.28,s:i%8,
    fx:Math.random()<.5?-1:1,tb:0.9+Math.random()*0.2,hd:Math.random()*6.28,mx:0,my:0,
    ax:Math.random()*6.28,ay:Math.random()*6.28,r:Math.random()*6.28,vx:spin(.3,.7),vy:spin(.3,.7),vr:spin(.1,.3)})}

  // grãos em 3D com WebGL: malha de grão revestida com fotos reais (lado chato com o sulco e dorso), luz quente e brilho de torra
  function beansGL(canvas){
    var gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});
    if(!gl)return null;
    var NU=48,NV=36,pos=[],nor=[],idx=[];
    function shape(u,v){
      // medidas tiradas das fotos: largura 74% do comprimento; dorso 0,62 e lado chato 0,33 de espessura
      var th=u*6.2832,ph=v*3.1416,r=Math.pow(Math.sin(ph),0.62),x=r*Math.cos(th)*0.68,y=-Math.cos(ph)*0.92,z=r*Math.sin(th);
      z*=z>0?0.33:0.62;
      // superfície lisa e fechada; o sulco aparece pela foto, sem recorte na malha (evita furos em alguns ângulos)
      return [x,y,z];
    }
    for(var j=0;j<=NV;j++)for(var i2=0;i2<=NU;i2++){
      var u=i2/NU,v=j/NV,p=shape(u,v),n;
      if(v<0.08||v>0.92){
        // pontas: normal do elipsoide, que não degenera no polo
        n=[p[0]/0.52,p[1]/0.85,p[2]/(p[2]>0?0.15:0.36)];
      }else{
        var e=0.002,a=shape(u+e,v),b=shape(u,v+e),du=[a[0]-p[0],a[1]-p[1],a[2]-p[2]],dv=[b[0]-p[0],b[1]-p[1],b[2]-p[2]];
        n=[du[1]*dv[2]-du[2]*dv[1],du[2]*dv[0]-du[0]*dv[2],du[0]*dv[1]-du[1]*dv[0]];
      }
      var l=Math.hypot(n[0],n[1],n[2])||1;n=[n[0]/l,n[1]/l,n[2]/l];if(n[0]*p[0]+n[1]*p[1]+n[2]*p[2]<0)n=[-n[0],-n[1],-n[2]];
      pos.push(p[0],p[1],p[2]);nor.push(n[0],n[1],n[2]);
    }
    for(j=0;j<NV;j++)for(i2=0;i2<NU;i2++){var k=j*(NU+1)+i2;idx.push(k,k+1,k+NU+1,k+1,k+NU+2,k+NU+1)}
    function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s}
    var prog=gl.createProgram();
    gl.attachShader(prog,sh(gl.VERTEX_SHADER,
      'attribute vec3 p;attribute vec3 n;uniform mat3 R;uniform vec3 T;uniform float S;uniform vec2 V;varying vec3 vn;varying vec3 vp;'+
      'void main(){vec3 w=R*p*S;vn=R*n;vp=p;vec3 q=w+T;gl_Position=vec4(q.x/V.x*2.-1.,1.-q.y/V.y*2.,-q.z/4000.,1.);}'));
    // textura: metade esquerda = foto do lado chato com o sulco, metade direita = foto do dorso; misturam-se na lateral
    // K espelha a foto (1 ou -1) e TB varia o tom, para os grãos não parecerem iguais
    gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,
      'precision mediump float;varying vec3 vn;varying vec3 vp;uniform float F;uniform float K;uniform float TB;uniform float TL;uniform sampler2D TX;'+
      'void main(){vec3 N=normalize(vn);vec3 L=normalize(vec3(-.55,-.65,.6));vec3 H=normalize(L+vec3(0.,0.,1.));'+
      'float dif=max(dot(N,L),0.);float spec=pow(max(dot(N,H),0.),48.);float rim=pow(1.-abs(N.z),3.);'+
      'vec2 uv=clamp(vec2(K*vp.x/.68*.5+.5,vp.y/.92*.5+.5),.01,.99);'+
      'vec3 fr=texture2D(TX,vec2(uv.x*.5,uv.y)).rgb;vec3 bk=texture2D(TX,vec2(.5+(1.-uv.x)*.5,uv.y)).rgb;'+
      'vec3 base=mix(vec3(.42,.24,.13),mix(bk,fr,smoothstep(-.08,.1,vp.z)),TL)*TB;'+
      'vec3 col=base*(.62+.6*dif)+vec3(1.,.88,.72)*spec*.18+vec3(1.,.6,.3)*rim*.08;'+
      'col=mix(vec3(.07,.055,.047),col,F);gl_FragColor=vec4(col,1.);}'));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return null;
    gl.useProgram(prog);
    function buf(data,name,size){var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
      var loc=gl.getAttribLocation(prog,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0)}
    buf(pos,'p',3);buf(nor,'n',3);
    var ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);
    var U={};['R','T','S','V','F','K','TB','TL','TX'].forEach(function(nm){U[nm]=gl.getUniformLocation(prog,nm)});
    gl.uniform1f(U.TL,0);gl.uniform1i(U.TX,0);
    var tex=gl.createTexture(),img=new Image();
    img.onload=function(){gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1f(U.TL,1)};
    img.src='img/graos-textura.webp';
    gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    var me={w:0,h:0};
    me.resize=function(){var d=Math.min(2,window.devicePixelRatio||1);me.w=canvas.clientWidth;me.h=canvas.clientHeight;canvas.width=me.w*d;canvas.height=me.h*d;gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(U.V,me.w,me.h)};
    // rotação em três eixos, em matriz 3x3 por colunas
    function rot(a,b,c2){var ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cc=Math.cos(c2),sc=Math.sin(c2);
      return [cb*cc,cb*sc,-sb, sa*sb*cc-ca*sc,sa*sb*sc+ca*cc,sa*cb, ca*sb*cc+sa*sc,ca*sb*sc-sa*cc,ca*cb]}
    me.draw=function(list){
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      list.forEach(function(o){gl.uniformMatrix3fv(U.R,false,rot(o.ax,o.ay,o.az));gl.uniform3f(U.T,o.x,o.y,o.z*600);gl.uniform1f(U.S,o.sz);gl.uniform1f(U.F,o.f);gl.uniform1f(U.K,o.k);gl.uniform1f(U.TB,o.tb);gl.drawElements(gl.TRIANGLES,idx.length,gl.UNSIGNED_SHORT,0)});
    };
    me.resize();return me;
  }
  var GB=null;try{GB=beansGL(bc)}catch(e){GB=null}
  var B=GB||!bc?null:fit(bc);
  // reserva sem WebGL: faixa com 8 fotos recortadas de grãos reais, 128px cada
  var beanImg=new Image(),BEAN=128;if(!GB&&bc)beanImg.src='img/graos.webp';
  function bean(x,y,sz,rot,ctx,k){
    if(!beanImg.complete||!beanImg.naturalWidth)return;
    ctx.save();ctx.translate(x,y);ctx.rotate(rot);
    ctx.drawImage(beanImg,k*BEAN,0,BEAN,BEAN,-sz*1.1,-sz*1.1,sz*2.2,sz*2.2);
    ctx.restore();
  }
  function beanSize(b,bw){return (16+16*b.z)*Math.min(1.3,Math.max(.75,bw/800))}
  // áreas do texto no topo (cada linha do título e do texto, botões e etiquetas), em px dentro do canvas
  var textBoxes=[];
  function measureText(){
    if(!bc)return;
    var cr=bc.getBoundingClientRect();textBoxes=[];
    document.querySelectorAll('.hero .label,.hero h1,.hero .lead,.hero .row a,.hero .tags span').forEach(function(el){
      var rects=el.matches('a,span')?[el.getBoundingClientRect()]:(function(){var rg=document.createRange();rg.selectNodeContents(el);return rg.getClientRects()})();
      [].forEach.call(rects,function(r){if(r.width)textBoxes.push({l:r.left-cr.left,t:r.top-cr.top,r:r.right-cr.left,b:r.bottom-cr.top})});
    });
  }
  // distância de um ponto até a caixa (0 dentro) e direção para sair dela
  function awayFrom(q,x,y){var cx=Math.max(q.l,Math.min(x,q.r)),cy=Math.max(q.t,Math.min(y,q.b)),dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);
    if(d===0){var mx=(q.l+q.r)/2,my=(q.t+q.b)/2;dx=x<mx?-1:1;dy=y<my?-1:1;var ex=Math.min(x-q.l,q.r-x),ey=Math.min(y-q.t,q.b-y);return ex<ey?{d:0,x:dx,y:0}:{d:0,x:0,y:dy}}
    return {d:d,x:dx/d,y:dy/d}}
  // posição inicial: sorteia pontos livres, longe do texto e dos outros grãos
  function placeBeans(){
    var bw=GB?GB.w:B.w,bh=GB?GB.h:B.h,n=bw<600?6:9;measureText();
    var placed=[];
    beans.forEach(function(b,i){
      b.on=i<n;if(!b.on)return;var s=beanSize(b,bw),best=null;
      for(var tr=0;tr<300;tr++){
        var x=bw*(0.04+Math.random()*0.92),y=bh*(0.08+Math.random()*0.86),pad=s*1.3;
        var hit=textBoxes.some(function(q){return awayFrom(q,x,y).d<pad});
        var near=placed.some(function(p){return Math.hypot(p.x-x,p.y-y)<(p.s+s)*1.8});
        if(!hit&&!near){best={x:x,y:y};break}
        if(!best&&!hit)best={x:x,y:y};
      }
      best=best||{x:bw*(i%2?0.94:0.06),y:bh*(0.15+0.7*Math.random())};
      b.px=best.x;b.py=best.y;b.x=1;placed.push({x:best.x,y:best.y,s:s});
    });
  }
  var lastT=null;
  function beansDraw(t){
    var bw=GB?GB.w:B.w,bh=GB?GB.h:B.h,sy=scrollY,list=[],dt=lastT===null?0:Math.min(0.05,t-lastT);lastT=t;
    if(beans[0].x<0)placeBeans();
    var live=beans.filter(function(b){return b.on});
    // movimento: cada grão segue uma direção que muda devagar e ao acaso; desvia do texto, das bordas e dos vizinhos
    if(dt>0)live.forEach(function(b){
      var s=beanSize(b,bw),sp=16+14*b.z;
      b.hd+=(Math.sin(t*0.27+b.ph*3)*0.7+(Math.random()-0.5)*1.6)*dt;
      var ax=(Math.cos(b.hd)*sp-b.mx)*1.2,ay=(Math.sin(b.hd)*sp-b.my)*1.2;
      textBoxes.forEach(function(q){var a=awayFrom(q,b.px,b.py),pad=s*1.6;if(a.d<pad){var k=(1-a.d/pad)*260;ax+=a.x*k;ay+=a.y*k}});
      var m=s*1.2;
      if(b.px<m)ax+=(m-b.px)*4;if(b.px>bw-m)ax-=(b.px-bw+m)*4;if(b.py<m)ay+=(m-b.py)*4;if(b.py>bh-m)ay-=(b.py-bh+m)*4;
      live.forEach(function(o){if(o===b)return;var dx=b.px-o.px,dy=b.py-o.py,d=Math.hypot(dx,dy)||1,lim=(s+beanSize(o,bw))*1.5;if(d<lim){var k=(1-d/lim)*120;ax+=dx/d*k;ay+=dy/d*k}});
      b.mx+=ax*dt;b.my+=ay*dt;var v=Math.hypot(b.mx,b.my),vmax=sp*2.2;if(v>vmax){b.mx*=vmax/v;b.my*=vmax/v}
      b.px+=b.mx*dt;b.py+=b.my*dt;
      // aponta a direção para longe quando bateu em algo
      if(Math.abs(ax)>60||Math.abs(ay)>60)b.hd=Math.atan2(b.my,b.mx);
    });
    live.slice().sort(function(a,b){return a.z-b.z}).forEach(function(b){
      // sobe com o scroll em velocidades diferentes (parallax)
      list.push({x:b.px,y:b.py-sy*(0.2+0.35*b.z),z:b.z,sz:beanSize(b,bw),f:0.82+0.18*b.z,k:b.fx,tb:b.tb,ax:b.ax+t*b.vx,ay:b.ay+t*b.vy,az:b.r+t*b.vr,s:b.s});
    });
    if(GB){GB.draw(list);return}
    var ctx=B.ctx;ctx.clearRect(0,0,bw,bh);
    list.forEach(function(o){ctx.globalAlpha=o.f;bean(o.x,o.y,o.sz,o.az,ctx,o.s)});ctx.globalAlpha=1;
  }
  if(document.fonts)document.fonts.ready.then(measureText);

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
    lastP=-1;if(window.createImageBitmap)createImageBitmap(im).then(function(b){bms[i]=b;lastP=-1},function(){});
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
  var t0=performance.now(),last=t0;
  function readAll(){dtarget=progC(dsec)*(drinks.length-1);revealUpd();stackUpd()}
  addEventListener('scroll',readAll,{passive:true});
  addEventListener('resize',function(){if(GB)GB.resize();else if(bc)B=fit(bc);measureText();D=fit(document.getElementById('dcv'));measureInfo();readAll()});
  readAll();dpos=dtarget;
  function onScreen(el){var r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight}
  // aproxima o valor do alvo em ~0,07 s, do mesmo jeito em qualquer taxa de quadros
  function follow(v,to,dt,tau){var d=to-v;return Math.abs(d)<1e-4?to:v+d*(1-Math.exp(-dt/tau))}
  function loop(){
    var now=performance.now(),t=reduce?0:(now-t0)/1000,dt=Math.min(0.1,(now-last)/1000);last=now;
    if(bc&&onScreen(bc))beansDraw(t);
    dpos=reduce?dtarget:follow(dpos,dtarget,dt,0.09);
    if(onScreen(dsec)){drinkDraw(dpos);setDrink(Math.round(slide(dpos)))}
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
