// páginas internas (cardápio e papelaria): revelação ao rolar e categoria ativa na barra de categorias
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

  // revelação ao rolar: só marca o que ainda está abaixo da primeira tela, para nada ficar escondido sem motivo
  if(!reduce&&'IntersectionObserver' in window){
    var rio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.remove('rv-pre');rio.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('[data-rv]').forEach(function(el,i){
      if(el.getBoundingClientRect().top>innerHeight){el.classList.add('rv-pre');el.style.transitionDelay=(i%3)*70+'ms';rio.observe(el)}
    });
  }

  // barra de categorias: acende a categoria que está na tela e mantém o botão dela visível na barra
  var links=[].slice.call(document.querySelectorAll('.cats a'));
  if(!links.length||!('IntersectionObserver' in window))return;
  var bar=document.querySelector('.cats');
  function mark(id){
    links.forEach(function(a){
      var on=a.getAttribute('href')==='#'+id;a.classList.toggle('on',on);
      if(on){var l=a.offsetLeft-16;if(l<bar.scrollLeft||a.offsetLeft+a.offsetWidth>bar.scrollLeft+bar.clientWidth)bar.scrollTo({left:l,behavior:reduce?'auto':'smooth'})}
    });
  }
  // observa o grupo inteiro (não só o título), para a categoria certa acender mesmo com o título no alto da tela
  var cio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)mark(e.target.dataset.cat)})},{rootMargin:'-35% 0px -55% 0px'});
  links.forEach(function(a){
    var id=a.getAttribute('href').slice(1),t=document.getElementById(id);if(!t)return;
    var g=t.closest('section')||t;g.dataset.cat=id;cio.observe(g);
    // ao tocar na categoria, revela o grupo antes de rolar, para o título não ficar deslocado atrás da barra
    a.addEventListener('click',function(){g.querySelectorAll('.rv-pre').forEach(function(el){el.classList.remove('rv-pre');el.style.transition='none'});mark(id)});
  });
})();
