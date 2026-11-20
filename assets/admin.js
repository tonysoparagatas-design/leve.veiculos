(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const config = window.LEVE_CONFIG || {};
  const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
    !String(config.SUPABASE_URL).includes('COLE_') &&
    !String(config.SUPABASE_ANON_KEY).includes('COLE_');

  let client = null;
  let vehicles = [];
  let currentUser = null;

  const formatPrice = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0
  }).format(Number(value || 0));
  const formatKm = (value) => `${new Intl.NumberFormat('pt-BR').format(Number(value || 0))} km`;
  const slugify = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const setMessage = (id, message, isError) => {
    const node = $(id);
    if (!node) return;
    node.textContent = message || '';
    node.style.color = isError ? '#f08b80' : '#f5a900';
  };

  function showApp(user) {
    currentUser = user;
    $('loginScreen').classList.add('hidden');
    $('adminApp').classList.remove('hidden');
    $('signedInAs').textContent = user?.email ? `Conectado como ${user.email}` : '';
    loadInventory();
    loadManagement();
  }

  function showLogin() {
    currentUser = null;
    $('adminApp').classList.add('hidden');
    $('loginScreen').classList.remove('hidden');
  }

  async function login(event) {
    event.preventDefault();
    setMessage('loginMessage', 'Validando acesso...');
    $('loginButton').disabled = true;
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: $('loginEmail').value.trim(),
        password: $('loginPassword').value
      });
      if (error) throw error;
      showApp(data.user);
      setMessage('loginMessage', '');
    } catch (error) {
      setMessage('loginMessage', error.message || 'Não foi possível entrar.', true);
    } finally {
      $('loginButton').disabled = false;
    }
  }

  async function loadInventory() {
    if (!client) return;
    $('inventoryBody').innerHTML = '<tr><td colspan="6">Carregando estoque...</td></tr>';
    const { data, error } = await client.from('vehicles')
      .select('id,brand,model,version,year_make,year_model,mileage,price,status,slug,created_at,cover_image')
      .order('created_at', { ascending: false });
    if (error) {
      $('inventoryBody').innerHTML = '<tr><td colspan="6">Não foi possível carregar os veículos.</td></tr>';
      setMessage('inventoryMessage', error.message, true);
      return;
    }
    vehicles = data || [];
    $('totalCount').textContent = vehicles.length;
    $('availableCount').textContent = vehicles.filter(v => v.status === 'available').length;
    $('reservedCount').textContent = vehicles.filter(v => v.status === 'reserved').length;
    $('soldCount').textContent = vehicles.filter(v => v.status === 'sold').length;
    renderInventory();
  }

  function renderInventory() {
    const body = $('inventoryBody');
    if (!vehicles.length) {
      body.innerHTML = '<tr><td colspan="6">Nenhum veículo cadastrado ainda.</td></tr>';
      return;
    }
    body.innerHTML = vehicles.map(v => {
      const statusLabel = v.status === 'available' ? 'Disponível' : v.status === 'reserved' ? 'Reservado' : 'Vendido';
      return `<tr><td><strong>${escapeHtml(v.brand)} ${escapeHtml(v.model)}</strong><small>${escapeHtml(v.version || '')}</small></td><td>${escapeHtml(v.year_make)}/${escapeHtml(v.year_model)}</td><td>${formatPrice(v.price)}</td><td>${formatKm(v.mileage)}</td><td><span class="status-pill status-${escapeHtml(v.status)}">${statusLabel}</span></td><td><button type="button" data-action="edit" data-id="${escapeHtml(v.id)}">Editar</button><button class="delete" type="button" data-action="delete" data-id="${escapeHtml(v.id)}">Excluir</button></td></tr>`;
    }).join('');
  }

  function readForm() {
    return {
      brand: $('brand').value.trim(),
      model: $('model').value.trim(),
      version: $('version').value.trim(),
      year_make: Number($('yearMake').value),
      year_model: Number($('yearModel').value),
      mileage: Number($('mileage').value || 0),
      engine: $('engine').value.trim(),
      transmission: $('transmission').value,
      fuel: $('fuel').value,
      color: $('color').value.trim(),
      doors: Number($('doors').value || 4),
      options: $('options').value.split(',').map(s => s.trim()).filter(Boolean),
      description: $('description').value.trim(),
      price: Number($('price').value),
      status: $('status').value
    };
  }

  function resetForm() {
    $('vehicleForm').reset();
    $('vehicleId').value = '';
    $('mileage').value = '0';
    $('doors').value = '4';
    $('formTitle').textContent = 'Cadastrar veículo';
    $('formEyebrow').textContent = 'NOVO ANÚNCIO';
    $('saveVehicleButton').textContent = 'Publicar veículo ↗';
    setMessage('formMessage', '');
  }

  function fillForm(vehicle) {
    $('vehicleId').value = vehicle.id;
    $('brand').value = vehicle.brand || '';
    $('model').value = vehicle.model || '';
    $('version').value = vehicle.version || '';
    $('price').value = vehicle.price ?? '';
    $('yearMake').value = vehicle.year_make ?? '';
    $('yearModel').value = vehicle.year_model ?? '';
    $('mileage').value = vehicle.mileage ?? 0;
    $('engine').value = vehicle.engine || '';
    $('transmission').value = vehicle.transmission || 'Automático';
    $('fuel').value = vehicle.fuel || 'Flex';
    $('color').value = vehicle.color || '';
    $('doors').value = vehicle.doors ?? 4;
    $('options').value = (vehicle.options || []).join(', ');
    $('description').value = vehicle.description || '';
    $('status').value = vehicle.status || 'available';
    $('formTitle').textContent = 'Editar veículo';
    $('formEyebrow').textContent = 'ATUALIZAR ANÚNCIO';
    $('saveVehicleButton').textContent = 'Salvar alterações ↗';
    $('photos').value = '';
    $('vehicleFormSection').scrollIntoView({ behavior: 'smooth' });
  }

  async function uploadPhotos(vehicleId, files) {
    const validFiles = Array.from(files || []);
    if (!validFiles.length) return null;
    let firstUrl = null;
    for (let i = 0; i < validFiles.length; i += 1) {
      const file = validFiles[i];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(`Formato não permitido: ${file.name}`);
      if (file.size > 10 * 1024 * 1024) throw new Error(`A imagem ${file.name} ultrapassa 10 MB.`);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${vehicleId}/${Date.now()}-${i}-${safeName}`;
      const { error: uploadError } = await client.storage.from('vehicle-photos').upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicData } = client.storage.from('vehicle-photos').getPublicUrl(path);
      const imageUrl = publicData.publicUrl;
      const { error: imageError } = await client.from('vehicle_images').insert({ vehicle_id: vehicleId, url: imageUrl, position: Date.now() + i });
      if (imageError) throw imageError;
      if (!firstUrl) firstUrl = imageUrl;
    }
    return firstUrl;
  }

  async function saveVehicle(event) {
    event.preventDefault();
    const saveButton = $('saveVehicleButton');
    saveButton.disabled = true;
    setMessage('formMessage', 'Salvando informações...');
    try {
      const form = readForm();
      if (!form.brand || !form.model || !form.year_make || !form.year_model) throw new Error('Preencha marca, modelo e anos do veículo.');
      if (!Number.isFinite(form.price) || form.price < 0) throw new Error('Informe um preço válido.');
      const existingId = $('vehicleId').value;
      const baseSlug = slugify(`${form.brand}-${form.model}-${form.year_model}`);
      const payload = { ...form, slug: existingId ? `${baseSlug}-${existingId.slice(0, 6)}` : `${baseSlug}-${Date.now().toString().slice(-6)}` };
      let vehicleId = existingId;

      if (existingId) {
        const { error } = await client.from('vehicles').update(payload).eq('id', existingId);
        if (error) throw error;
      } else {
        const { data, error } = await client.from('vehicles').insert(payload).select('id').single();
        if (error) throw error;
        vehicleId = data.id;
      }

      const firstUrl = await uploadPhotos(vehicleId, $('photos').files);
      if (firstUrl) {
        const { error } = await client.from('vehicles').update({ cover_image: firstUrl }).eq('id', vehicleId);
        if (error) throw error;
      }
      setMessage('formMessage', 'Veículo salvo com sucesso.');
      resetForm();
      await loadInventory();
    } catch (error) {
      setMessage('formMessage', error.message || 'Não foi possível salvar o veículo.', true);
    } finally {
      saveButton.disabled = false;
    }
  }

  async function deleteVehicle(id) {
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle || !window.confirm(`Excluir ${vehicle.brand} ${vehicle.model}? Esta ação não poderá ser desfeita.`)) return;
    const { error } = await client.from('vehicles').delete().eq('id', id);
    if (error) {
      setMessage('inventoryMessage', error.message, true);
      return;
    }
    setMessage('inventoryMessage', 'Veículo excluído.');
    await loadInventory();
  }

  async function handleTableAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const vehicle = vehicles.find(v => v.id === button.dataset.id);
    if (!vehicle) return;
    if (button.dataset.action === 'edit') fillForm(vehicle);
    if (button.dataset.action === 'delete') await deleteVehicle(vehicle.id);
  }

  async function logout() {
    if (!client) return;
    await client.auth.signOut();
    showLogin();
  }


  let slides = [], customers = [], staffUsers = [];
  const setRows = (id, html) => { if ($(id)) $(id).innerHTML = html; };
  async function loadSlides() {
    const { data, error } = await client.from('site_slides').select('*').order('position').order('created_at');
    if (error) { setMessage('slideMessage', error.message, true); return; }
    slides = data || [];
    setRows('slidesBody', slides.length ? slides.map(x => `<tr><td><img class="admin-thumb" src="${escapeHtml(x.image_url)}" alt=""></td><td>${escapeHtml(x.title || 'Sem título')}</td><td>${x.position}</td><td>${x.active ? 'Ativo' : 'Inativo'}</td><td><button type="button" data-slide-action="edit" data-id="${x.id}">Editar</button><button class="delete" type="button" data-slide-action="delete" data-id="${x.id}">Excluir</button></td></tr>`).join('') : '<tr><td colspan="5">Nenhuma imagem cadastrada.</td></tr>');
  }
  function clearSlide() { $('slideForm').reset(); $('slideId').value=''; $('slidePosition').value='0'; setMessage('slideMessage',''); }
  async function saveSlide(e) {
    e.preventDefault(); const btn=$('saveSlideButton'); btn.disabled=true;
    try {
      const id=$('slideId').value; let imageUrl=$('slideImageUrl').value.trim(); const file=$('slideImage').files[0];
      if (file) { if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>10*1024*1024) throw new Error('Use JPG, PNG ou WebP de até 10 MB.'); const path=`slides/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`; const up=await client.storage.from('site-media').upload(path,file,{contentType:file.type}); if(up.error) throw up.error; imageUrl=client.storage.from('site-media').getPublicUrl(path).data.publicUrl; }
      if (!imageUrl && !id) throw new Error('Selecione uma imagem ou informe uma URL.');
      const payload={title:$('slideTitle').value.trim(),subtitle:$('slideSubtitle').value.trim(),position:Number($('slidePosition').value||0),active:$('slideActive').value==='true'}; if(imageUrl) payload.image_url=imageUrl;
      const result=id ? await client.from('site_slides').update(payload).eq('id',id) : await client.from('site_slides').insert(payload); if(result.error) throw result.error;
      setMessage('slideMessage','Imagem do carrossel salva.'); clearSlide(); await loadSlides();
    } catch(err){setMessage('slideMessage',err.message||'Erro ao salvar imagem.',true);} finally{btn.disabled=false;}
  }
  async function slideAction(e){const b=e.target.closest('button[data-slide-action]');if(!b)return;const item=slides.find(x=>x.id===b.dataset.id);if(!item)return;if(b.dataset.slideAction==='edit'){ $('slideId').value=item.id;$('slideTitle').value=item.title||'';$('slideSubtitle').value=item.subtitle||'';$('slidePosition').value=item.position||0;$('slideActive').value=String(item.active);$('slideImageUrl').value=item.image_url;$('slidesSection').scrollIntoView({behavior:'smooth'});}else if(confirm('Excluir esta imagem do carrossel?')){const r=await client.from('site_slides').delete().eq('id',item.id);if(r.error)setMessage('slideMessage',r.error.message,true);else loadSlides();}}
  async function loadCustomers(){const r=await client.from('customers').select('*').order('created_at',{ascending:false});if(r.error){setMessage('customerMessage',r.error.message,true);return;}customers=r.data||[];setRows('customersBody',customers.length?customers.map(c=>`<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.phone)}</td><td>${escapeHtml(c.email||'')}</td><td><button type="button" data-customer-action="edit" data-id="${c.id}">Editar</button><button class="delete" type="button" data-customer-action="delete" data-id="${c.id}">Excluir</button></td></tr>`).join(''):'<tr><td colspan="4">Nenhum cliente cadastrado.</td></tr>');}
  function clearCustomer(){$('customerForm').reset();$('customerId').value='';setMessage('customerMessage','');}
  async function saveCustomer(e){e.preventDefault();const id=$('customerId').value;const payload={name:$('customerName').value.trim(),phone:$('customerPhone').value.trim(),email:$('customerEmail').value.trim()||null,document:$('customerDocument').value.trim()||null,notes:$('customerNotes').value.trim()||null};try{const r=id?await client.from('customers').update(payload).eq('id',id):await client.from('customers').insert(payload);if(r.error)throw r.error;setMessage('customerMessage','Cliente salvo com sucesso.');clearCustomer();await loadCustomers();}catch(err){setMessage('customerMessage',err.message,true);}}
  async function customerAction(e){const b=e.target.closest('button[data-customer-action]');if(!b)return;const c=customers.find(x=>x.id===b.dataset.id);if(!c)return;if(b.dataset.customerAction==='edit'){$('customerId').value=c.id;$('customerName').value=c.name;$('customerPhone').value=c.phone;$('customerEmail').value=c.email||'';$('customerDocument').value=c.document||'';$('customerNotes').value=c.notes||'';$('customersSection').scrollIntoView({behavior:'smooth'});}else if(confirm(`Excluir o cadastro de ${c.name}?`)){const r=await client.from('customers').delete().eq('id',c.id);if(r.error)setMessage('customerMessage',r.error.message,true);else loadCustomers();}}
  async function callUserFunction(body){const {data,error}=await client.functions.invoke('admin-users',{body});if(error)throw error; if(data?.error)throw new Error(data.error);return data;}
  async function loadStaff(){try{const d=await callUserFunction({action:'list'});staffUsers=d.users||[];setRows('usersBody',staffUsers.length?staffUsers.map(u=>`<tr><td>${escapeHtml(u.name||'')}</td><td>${escapeHtml(u.email||'')}</td><td>${escapeHtml(u.role||'Equipe')}</td><td><button class="delete" type="button" data-user-delete="${escapeHtml(u.id)}">Remover</button></td></tr>`).join(''):'<tr><td colspan="4">Nenhum usuário adicional.</td></tr>');}catch(err){setRows('usersBody','<tr><td colspan="4">Configure e publique a função Supabase admin-users para gerenciar usuários.</td></tr>');setMessage('userMessage',err.message||'Não foi possível listar usuários.',true);}}
  async function createStaff(e){e.preventDefault();const b=$('createUserButton');b.disabled=true;try{await callUserFunction({action:'create',name:$('userName').value.trim(),email:$('userEmail').value.trim(),password:$('userPassword').value,role:$('userRole').value});$('userForm').reset();setMessage('userMessage','Usuário criado com sucesso.');await loadStaff();}catch(err){setMessage('userMessage',err.message||'Falha ao criar usuário.',true);}finally{b.disabled=false;}}
  async function deleteStaff(e){const b=e.target.closest('[data-user-delete]');if(!b)return;if(!confirm('Remover este usuário do acesso administrativo?'))return;try{await callUserFunction({action:'delete',user_id:b.dataset.userDelete});await loadStaff();setMessage('userMessage','Usuário removido.');}catch(err){setMessage('userMessage',err.message,true);}}
  async function loadManagement(){await Promise.all([loadSlides(),loadCustomers(),loadStaff()]);}

  async function init() {
    if (!configured || !window.supabase?.createClient) {
      setMessage('loginMessage', 'Configure a URL e a chave pública do Supabase em assets/config.js antes de usar o painel.', true);
      $('loginButton').disabled = true;
      return;
    }
    client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    $('loginForm').addEventListener('submit', login);
    $('vehicleForm').addEventListener('submit', saveVehicle);
    $('clearFormButton').addEventListener('click', resetForm);
    $('refreshButton').addEventListener('click', loadInventory);
    $('logoutButton').addEventListener('click', logout);
    $('inventoryBody').addEventListener('click', handleTableAction);
    $('slideForm').addEventListener('submit', saveSlide); $('clearSlideButton').addEventListener('click', clearSlide); $('slidesBody').addEventListener('click', slideAction);
    $('customerForm').addEventListener('submit', saveCustomer); $('clearCustomerButton').addEventListener('click', clearCustomer); $('customersBody').addEventListener('click', customerAction);
    $('userForm').addEventListener('submit', createStaff); $('usersBody').addEventListener('click', deleteStaff);

    const { data, error } = await client.auth.getSession();
    if (error) setMessage('loginMessage', error.message, true);
    if (data?.session?.user) showApp(data.session.user);
    client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) showApp(session.user);
      else showLogin();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
