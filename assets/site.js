(function () {
  'use strict';

  const CONTACTS = {
    diogo: '5519986055364',
    igor: '5519986055364'
  };

  const $ = (selector) => document.querySelector(selector);
  const formatPrice = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0
  }).format(Number(value || 0));
  const formatKm = (value) => `${new Intl.NumberFormat('pt-BR').format(Number(value || 0))} km`;
  const waLink = (person, message) => `https://wa.me/${CONTACTS[person] || CONTACTS.diogo}?text=${encodeURIComponent(message)}`;

  function setupWhatsApp() {
    document.querySelectorAll('[data-whatsapp]').forEach((anchor) => {
      const person = anchor.dataset.whatsapp || 'diogo';
      const message = anchor.dataset.message || 'Olá! Acessei o site da Leve Veículos e gostaria de falar com um consultor.';
      anchor.href = waLink(person, message);
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    });
  }

  function initMenu() {
    const toggle = $('#menuToggle');
    const nav = $('.main-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const opened = nav.classList.toggle('mobile-open');
      toggle.setAttribute('aria-expanded', String(opened));
      toggle.textContent = opened ? '×' : '☰';
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('mobile-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '☰';
    }));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  let allVehicles = [];

  function renderVehicles() {
    const grid = $('#vehicleGrid');
    if (!grid) return;
    const search = ($('#vehicleSearch')?.value || '').trim().toLocaleLowerCase('pt-BR');
    const sort = $('#sortVehicles')?.value || 'recent';
    let list = allVehicles.filter((vehicle) => {
      const haystack = `${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.version || ''}`.toLocaleLowerCase('pt-BR');
      return haystack.includes(search);
    });

    list.sort((a, b) => {
      if (sort === 'price-asc') return Number(a.price) - Number(b.price);
      if (sort === 'price-desc') return Number(b.price) - Number(a.price);
      if (sort === 'year') return Number(b.year_model) - Number(a.year_model);
      if (sort === 'mileage') return Number(a.mileage) - Number(b.mileage);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state"><h3>${allVehicles.length ? 'Nenhum veículo encontrado.' : 'Novas oportunidades em breve.'}</h3><p>${allVehicles.length ? 'Tente outra busca ou fale com a equipe para consultar outras opções.' : 'Nosso estoque está sendo atualizado. Entre em contato com a equipe da Leve Veículos para consultar as opções disponíveis.'}</p><a class="button button-gold" href="${waLink('diogo', 'Olá! Gostaria de consultar os veículos disponíveis na Leve Veículos.')}" target="_blank" rel="noopener">Consultar pelo WhatsApp ↗</a></div>`;
      return;
    }

    grid.innerHTML = list.map((v) => {
      const image = v.cover_image || (v.vehicle_images || []).slice().sort((a, b) => a.position - b.position)[0]?.url || '';
      const message = `Olá! Acessei o site da Leve Veículos e gostaria de mais informações sobre o ${v.brand} ${v.model} ${v.year_model}, anunciado por ${formatPrice(v.price)}.`;
      return `<article class="vehicle-card">
        <div class="vehicle-image" aria-label="Foto do veículo ${escapeHtml(v.brand)} ${escapeHtml(v.model)}">
          ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(v.brand)} ${escapeHtml(v.model)}" loading="lazy">` : '<div class="loading-state">FOTO DO VEÍCULO</div>'}
          <span class="vehicle-status">DISPONÍVEL</span>
        </div>
        <div class="vehicle-info">
          <div class="vehicle-title"><div><div class="eyebrow">${escapeHtml(v.year_make)}/${escapeHtml(v.year_model)}</div><h3>${escapeHtml(v.brand)} ${escapeHtml(v.model)}</h3><p>${escapeHtml(v.version || 'Consulte a versão')}</p></div><strong class="vehicle-price">${formatPrice(v.price)}</strong></div>
          <div class="vehicle-specs"><span>◷ ${formatKm(v.mileage)}</span><span>⚙ ${escapeHtml(v.transmission || 'Consulte')}</span><span>◉ ${escapeHtml(v.fuel || 'Consulte')}</span></div>
          <a class="vehicle-open" href="${waLink('diogo', message)}" target="_blank" rel="noopener">Consultar este veículo <span>↗</span></a>
        </div>
      </article>`;
    }).join('');
    // A versão estática de duas páginas direciona o interessado ao WhatsApp do consultor.
  }

  async function loadVehicles() {
    const grid = $('#vehicleGrid');
    const config = window.LEVE_CONFIG || {};
    const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
      !String(config.SUPABASE_URL).includes('COLE_') &&
      !String(config.SUPABASE_ANON_KEY).includes('COLE_');

    if (!configured || !window.supabase?.createClient) {
      if (grid) grid.innerHTML = '<div class="empty-state"><h3>Catálogo em configuração.</h3><p>O site está pronto para receber o estoque. Configure as credenciais do Supabase no arquivo <strong>assets/config.js</strong> e cadastre os veículos pelo painel administrativo.</p><a class="button button-gold" href="admin.html">Acessar painel da equipe ↗</a></div>';
      return;
    }

    try {
      const client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
      const { data, error } = await client.from('vehicles')
        .select('id,brand,model,version,year_make,year_model,mileage,transmission,fuel,price,status,cover_image,created_at,vehicle_images(id,url,position)')
        .eq('status', 'available').order('created_at', { ascending: false });
      if (error) throw error;
      allVehicles = data || [];
      renderVehicles();
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
      if (grid) grid.innerHTML = '<div class="empty-state"><h3>Não foi possível carregar o estoque.</h3><p>Verifique a configuração e as políticas de acesso do Supabase. Você também pode falar diretamente com nossa equipe.</p><a class="button button-gold" href="' + waLink('diogo', 'Olá! Gostaria de consultar o estoque da Leve Veículos.') + '" target="_blank" rel="noopener">Consultar pelo WhatsApp ↗</a></div>';
    }
  }


  async function setupHeroCarousel() {
    const root=$('#heroCarousel'); if(!root)return;
    const config=window.LEVE_CONFIG||{}; if(!window.supabase?.createClient||!config.SUPABASE_URL||!config.SUPABASE_ANON_KEY||String(config.SUPABASE_URL).includes('COLE_'))return;
    try { const db=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY); const {data,error}=await db.from('site_slides').select('id,title,subtitle,image_url,position').eq('active',true).order('position').order('created_at'); if(error)throw error; if(!data?.length)return;
      root.innerHTML=data.map((slide,i)=>`<div class="hero-bg hero-slide ${i===0?'active':''}" style="background-image:url('${String(slide.image_url).replace(/'/g,'%27')}')" aria-label="${escapeHtml(slide.title||'Destaque Leve Veículos')}"></div>`).join('');
      const dots=$('#heroDots'); if(dots) dots.innerHTML=data.map((_,i)=>`<button type="button" class="hero-dot ${i===0?'active':''}" data-slide-to="${i}" aria-label="Ir para imagem ${i+1}"></button>`).join('');
      let current=0,timer=null; const slides=[...root.querySelectorAll('.hero-slide')]; const counter=$('#heroCounter');
      function show(index){current=(index+slides.length)%slides.length;slides.forEach((el,i)=>el.classList.toggle('active',i===current));dots?.querySelectorAll('button').forEach((el,i)=>el.classList.toggle('active',i===current));if(counter)counter.innerHTML=`${String(current+1).padStart(2,'0')} <i></i> ${String(slides.length).padStart(2,'0')}`;}
      function restart(){if(timer)clearInterval(timer);if(slides.length>1)timer=setInterval(()=>show(current+1),5500);}
      $('#heroPrev')?.addEventListener('click',()=>{show(current-1);restart();});$('#heroNext')?.addEventListener('click',()=>{show(current+1);restart();});dots?.addEventListener('click',e=>{const b=e.target.closest('[data-slide-to]');if(b){show(Number(b.dataset.slideTo));restart();}});show(0);restart();
    } catch(err){console.warn('Não foi possível carregar o carrossel administrável:',err);}
  }

  function setupTradeForm() {
    const form = $('#tradeForm');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      const message = `Olá! Gostaria de solicitar uma conversa sobre a avaliação do meu veículo na Leve Veículos.\n\nNome: ${values.name}\nWhatsApp: ${values.phone}\nVeículo: ${values.vehicle}\nAno: ${values.year}\nQuilometragem: ${values.mileage || 'Não informada'}`;
      window.open(waLink('igor', message), '_blank', 'noopener,noreferrer');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupWhatsApp();
    initMenu();
    setupTradeForm();
    setupHeroCarousel();
    const year = $('#yearNow');
    if (year) year.textContent = new Date().getFullYear();
    $('#vehicleSearch')?.addEventListener('input', renderVehicles);
    $('#sortVehicles')?.addEventListener('change', renderVehicles);
    loadVehicles();
  });
})();
