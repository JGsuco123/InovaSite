/* ============================================================
   Camaçari INOVA — script.js
   - Mapa: Leaflet + OpenStreetMap (sem chave de API)
   - CEP: ViaCEP | Geocodificação: Nominatim (OpenStreetMap)
   - Login, organizações e perfil: salvos no navegador (localStorage)
   - Painel: Mapa integrado diretamente na área logada, diagnóstico
     interno, KPIs interativos e navegação sem sair do app.
   ============================================================ */

/* ---------- 1) CONFIGURAÇÃO ---------- */
const ADMIN_EMAILS = ['admin@camacariinova.com'];   // quem se cadastrar com esses e-mails vira moderador
const SHOW_DEMO = false;                             // não exibe dados de demonstração no mapa

/* ---------- SUPABASE CLIENT CONFIGURATION ---------- */
const SUPABASE_URL = 'https://rgcnqtejewjmpabelcjc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ECFAuOkP5b8XpFGlimPP3w_bS1c27jg';
const sb = (window.supabase && typeof window.supabase.createClient === 'function')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
let currentSupabaseUser = null;

const TIPOS = {
  empresa:    { nome: 'Empresa',                        cor: '#FF5500' },
  startup:    { nome: 'Startup',                        cor: '#C2185B' },
  ensino:     { nome: 'Ensino e pesquisa',              cor: '#6FB000' },
  governo:    { nome: 'Governo / Poder público',        cor: '#E39A00' },
  associacao: { nome: 'Associação / Sindicato',         cor: '#06006B' },
  ong:        { nome: 'ONG / Terceiro setor',           cor: '#00897B' },
  fomento:    { nome: 'Fomento / Investidor',           cor: '#6A1B9A' },
  hub:        { nome: 'Hub / Incubadora / Aceleradora', cor: '#0277BD' },
  outro:      { nome: 'Outro',                          cor: '#607D8B' }
};

const CIDADES = {
  'Camaçari': [-12.6996, -38.3263], 'Salvador': [-12.9777, -38.5016], 'Lauro de Freitas': [-12.8978, -38.3210],
  'Simões Filho': [-12.7866, -38.4029], "Dias d'Ávila": [-12.6153, -38.3000], 'Mata de São João': [-12.5256, -38.2999],
  'Pojuca': [-12.4306, -38.3358], 'Catu': [-12.3539, -38.3792], 'Candeias': [-12.6717, -38.5469],
  'Itaparica': [-12.8903, -38.6803], 'Madre de Deus': [-12.7433, -38.6128],
  'São Sebastião do Passé': [-12.5161, -38.4903], 'São Francisco do Conde': [-12.6186, -38.6808]
};

const STATUS = {
  analise:   'Em análise',
  aprovada:  'Aprovada e publicada',
  rejeitada: 'Não aprovada',
  privada:   'Não publicada (sem autorização)'
};

/* Exemplos (demonstração) */
const DEMO = [
  { id: 'demo1', nome: 'Polo Petroquímico Inovação', tipo: 'empresa',    cidade: 'Camaçari', lat: -12.6996, lng: -38.3263, comp: 'Química verde, Automação, ESG', desc: 'Indústria e centro de inovação com foco em sustentabilidade e eficiência energética.' },
  { id: 'demo2', nome: 'Campus Tecnológico Integrado', tipo: 'ensino',     cidade: 'Camaçari', lat: -12.6900, lng: -38.3100, comp: 'Pesquisa aplicada, IA, Capacitação técnica', desc: 'Instituição de ensino e laboratórios avançados para projetos com a indústria.' },
  { id: 'demo3', nome: 'Secretaria de Desenvolvimento Econômico', tipo: 'governo',    cidade: 'Camaçari', lat: -12.6980, lng: -38.3380, comp: 'Políticas públicas, Fomento, Atração de investimentos', desc: 'Poder público fomentando a inovação e parcerias empresariais na RMS.' },
  { id: 'demo4', nome: 'Hub Camaçari Tech', tipo: 'hub',        cidade: 'Camaçari', lat: -12.7050, lng: -38.3190, comp: 'Aceleração, Mentoria, Espaço Maker', desc: 'Ambiente de inovação aberta, coworking e aceleração de soluções digitais e industriais.' },
  { id: 'demo5', nome: 'BioInova Bahia', tipo: 'startup',    cidade: "Dias d'Ávila", lat: -12.6153, lng: -38.3000, comp: 'Biotecnologia, Resíduos, Novos materiais', desc: 'Startup desenvolvendo biomateriais a partir de subprodutos da cadeia produtiva local.' }
].map(o => ({ ...o, demo: true, autoriza: true, status: 'aprovada', areas: [o.cidade] }));

/* ---------- 2) "BANCO DE DADOS" (localStorage) ---------- */
const LS = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};
const DB = {
  users: () => LS.get('inova_users', []),
  saveUsers: u => LS.set('inova_users', u),
  orgs: () => LS.get('inova_orgs', []),
  saveOrgs: o => LS.set('inova_orgs', o),
  session: () => LS.get('inova_session', null),
  setSession: id => id ? LS.set('inova_session', id) : localStorage.removeItem('inova_session')
};

/* ---------- 3) UTILITÁRIOS ---------- */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = t => String(t ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const ic = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
const initials = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const fmtDate = iso => new Date(iso).toLocaleDateString('pt-BR');
const tags = s => String(s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
const isUrl = v => { try { const u = new URL(v); return /^https?:$/.test(u.protocol); } catch { return false; } };

function refreshIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function toast(msg, isErr) {
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

async function hashPwd(p, salt) {
  if (!(window.crypto && crypto.subtle)) return btoa(salt + p);
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + p));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- 4) SESSÃO / AUTENTICAÇÃO ---------- */
const user = () => currentSupabaseUser || DB.users().find(u => u.id === DB.session()) || null;
const isAdmin = u => !!u && (u.admin || ADMIN_EMAILS.includes(u.email));
let afterLogin = null;

function openAuth(tab = 'login', msg = '') {
  setTab(tab);
  const m = $('#authMsg'); m.hidden = !msg; m.textContent = msg;
  $('#authDlg').showModal();
  setTimeout(() => $(tab === 'login' ? '#l-email' : '#r-nome').focus(), 50);
}
function setTab(tab) {
  $('#authTitle').textContent = tab === 'login' ? 'Entrar' : 'Criar conta';
  $('#loginForm').hidden = tab !== 'login';
  $('#registerForm').hidden = tab !== 'register';
  $('#tabLogin').classList.toggle('on', tab === 'login');
  $('#tabRegister').classList.toggle('on', tab === 'register');
  $('#loginErr').textContent = ''; $('#registerErr').textContent = '';
}

$('#registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const nome = $('#r-nome').value.trim(), email = $('#r-email').value.trim().toLowerCase();
  const p1 = $('#r-pass').value, p2 = $('#r-pass2').value, err = $('#registerErr');
  err.textContent = '';
  if (nome.length < 3) return err.textContent = 'Informe seu nome completo.';
  if (!/^\S+@\S+\.\S+$/.test(email)) return err.textContent = 'E-mail inválido.';
  if (p1.length < 8) return err.textContent = 'A senha deve ter pelo menos 8 caracteres.';
  if (p1 !== p2) return err.textContent = 'As senhas não conferem.';
  if (!$('#r-termos').checked) return err.textContent = 'É preciso concordar com o uso dos dados.';

  const btn = e.target.querySelector('button[type="submit"]');
  const oldText = btn.textContent;
  btn.disabled = true; btn.textContent = 'Criando conta…';

  try {
    let supaUserId = null;
    let emailConfirmationRequired = false;
    if (sb) {
      try {
        const { data, error } = await sb.auth.signUp({
          email,
          password: p1,
          options: { data: { nome, full_name: nome } }
        });
        if (error) {
          if (error.message.includes('already registered')) {
            return err.textContent = 'Já existe uma conta cadastrada com este e-mail.';
          }
          return err.textContent = error.message;
        }
        if (data?.user) {
          supaUserId = data.user.id;
          if (!data.session) {
            emailConfirmationRequired = true;
          }
          currentSupabaseUser = {
            id: data.user.id,
            nome,
            email,
            tel: '',
            cargo: '',
            admin: ADMIN_EMAILS.includes(email)
          };
        }
      } catch (sbErr) {
        console.warn('Supabase auth warning:', sbErr);
      }
    }

    const users = DB.users();
    const existing = users.find(u => u.email === email);
    const uidFinal = supaUserId || (existing ? existing.id : uid());
    if (!existing) {
      const salt = uid();
      const u = { id: uidFinal, nome, email, tel: '', cargo: '', salt, hash: await hashPwd(p1, salt), admin: ADMIN_EMAILS.includes(email), criado: new Date().toISOString() };
      users.push(u);
      DB.saveUsers(users);
    }
    DB.setSession(uidFinal);

    // Migra diagnóstico de convidado se houver
    const uidToUse = currentSupabaseUser ? currentSupabaseUser.id : DB.session();
    const guestDiag = LS.get('inova_diag_guest', null);
    if (guestDiag) { LS.set('inova_diag_' + uidToUse, guestDiag); }

    e.target.reset();
    if (emailConfirmationRequired) {
      toast('Conta criada no Supabase! Verifique seu e-mail para ativar se necessário.');
    }
    finishAuth(`Conta criada! Bem-vindo(a), ${nome.split(' ')[0]}.`);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
});

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#l-email').value.trim().toLowerCase(), pass = $('#l-pass').value, err = $('#loginErr');
  err.textContent = '';
  if (!email || !pass) return err.textContent = 'Preencha o e-mail e a senha.';

  const btn = e.target.querySelector('button[type="submit"]');
  const oldText = btn.textContent;
  btn.disabled = true; btn.textContent = 'Entrando…';

  try {
    if (sb) {
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (!error && data?.user) {
          let prof = null;
          try {
            const res = await sb.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
            prof = res.data;
          } catch (_) {}

          currentSupabaseUser = {
            id: data.user.id,
            nome: prof?.nome || data.user.user_metadata?.nome || email.split('@')[0],
            email: data.user.email,
            tel: prof?.telefone || '',
            cargo: prof?.cargo || '',
            admin: prof?.is_admin || ADMIN_EMAILS.includes(data.user.email)
          };
          DB.setSession(data.user.id);

          const guestDiag = LS.get('inova_diag_guest', null);
          if (guestDiag && !LS.get('inova_diag_' + data.user.id, null)) {
            LS.set('inova_diag_' + data.user.id, guestDiag);
          }

          await fetchOrgsFromSupabase();
          await syncConnectionsAndMessages();
          e.target.reset();
          return finishAuth(`Olá, ${currentSupabaseUser.nome.split(' ')[0]}!`);
        } else if (error) {
          if (error.message.includes('Email not confirmed')) {
            return err.textContent = 'E-mail não confirmado. Verifique sua caixa de entrada ou desative "Confirm email" nas configurações de Auth do Supabase.';
          } else if (error.message.includes('Invalid login credentials')) {
            // Tenta fallback local antes de exibir erro definitivo
            const localU = DB.users().find(x => x.email === email);
            if (!localU || localU.hash !== await hashPwd(pass, localU.salt)) {
              return err.textContent = 'E-mail ou senha incorretos.';
            }
          } else {
            return err.textContent = error.message;
          }
        }
      } catch (sbErr) {
        console.warn('Supabase login warning:', sbErr);
      }
    }

    // Fallback local caso offline ou cadastrado localmente
    const u = DB.users().find(x => x.email === email);
    if (!u || u.hash !== await hashPwd(pass, u.salt)) return err.textContent = 'E-mail ou senha incorretos.';
    DB.setSession(u.id);

    const guestDiag = LS.get('inova_diag_guest', null);
    if (guestDiag && !LS.get('inova_diag_' + u.id, null)) {
      LS.set('inova_diag_' + u.id, guestDiag);
    }

    e.target.reset();
    finishAuth(`Olá, ${u.nome.split(' ')[0]}!`);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
});

function finishAuth(msg) {
  $('#authDlg').close();
  toast(msg);
  renderAuthUI();
  const fn = afterLogin; afterLogin = null;
  fn ? fn() : goApp('dashboard');
}

async function logout() {
  if (sb) {
    try { await sb.auth.signOut(); } catch (_) {}
  }
  currentSupabaseUser = null;
  DB.setSession(null);
  renderAuthUI();
  location.hash = '#inicio';
  route();
  toast('Você saiu da conta.');
}

function requireAuth(fn, msg) {
  if (user()) return fn();
  afterLogin = fn;
  openAuth('login', msg || 'Entre ou crie uma conta para continuar.');
}

/* ---------- SINCRONIZAÇÃO COM SUPABASE ---------- */
function mapSupabaseOrg(o) {
  return {
    id: o.id,
    ownerId: o.owner_id,
    tipoCadastro: o.tipo_cadastro,
    nome: o.nome,
    razaoSocial: o.razao_social,
    cnpj: o.cnpj,
    tipo: o.tipo,
    cep: o.cep,
    numero: o.numero,
    rua: o.rua,
    bairro: o.bairro,
    cidade: o.cidade,
    areas: o.areas || [],
    desc: o.descricao,
    comp: o.competencias,
    rec: o.recursos,
    dem: o.demandas,
    site: o.site,
    email: o.email,
    linkedin: o.linkedin,
    telefone: o.telefone_contato,
    outros: o.outros_contato,
    autoriza: o.autoriza,
    lat: o.lat,
    lng: o.lng,
    status: o.status,
    motivo: o.motivo_rejeicao,
    demo: o.is_demo,
    criado: o.created_at,
    atualizado: o.updated_at
  };
}

async function fetchOrgsFromSupabase() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('organizacoes').select('*');
    if (error) {
      console.warn('Erro ao sincronizar organizações com Supabase:', error);
      return;
    }
    if (Array.isArray(data)) {
      const mapped = data.map(mapSupabaseOrg);
      DB.saveOrgs(mapped);
      refreshAllMaps();
    }
  } catch (e) {
    console.warn('Erro ao sincronizar organizações com Supabase:', e);
  }
}

async function syncConnectionsAndMessages() {
  if (!sb || !user()) return;
  try {
    const { data: conns } = await sb.from('conexoes').select('*');
    if (conns && conns.length) {
      const localConns = connections();
      const merged = [...localConns];
      const requesterIds = [...new Set(conns.map(c => c.solicitante_id))];
      const { data: requesters, error: requestersError } = await sb
        .from('profiles')
        .select('id, nome')
        .in('id', requesterIds);
      if (requestersError) console.warn('Erro ao carregar perfis das solicitações:', requestersError);
      const requesterNames = new Map((requesters || []).map(profile => [profile.id, profile.nome]));
      conns.forEach(c => {
        const idx = merged.findIndex(x => x.id === c.id);
        const existing = idx >= 0 ? merged[idx] : {};
        const item = {
          id: c.id,
          from: c.solicitante_id,
          target: c.organizacao_alvo_id,
          status: c.status,
          created: c.created_at,
          requesterName: requesterNames.get(c.solicitante_id) || existing.requesterName || '',
          messages: []
        };
        if (idx >= 0) merged[idx] = { ...merged[idx], ...item };
        else merged.push(item);
      });
      LS.set('inova_connections', merged);
    }

    const { data: msgs } = await sb.from('mensagens').select('*').order('created_at', { ascending: true });
    if (msgs && msgs.length) {
      const conns = connections();
      msgs.forEach(m => {
        const c = conns.find(x => x.id === m.conexao_id);
        if (c) {
          if (!c.messages) c.messages = [];
          if (!c.messages.some(x => x.id === m.id)) {
            c.messages.push({
              id: m.id,
              sender: m.remetente_id,
              text: m.conteudo,
              created: m.created_at
            });
          }
        }
      });
      LS.set('inova_connections', conns);
    }
  } catch (e) {
    console.warn('Erro ao sincronizar conexões/mensagens:', e);
  }
}

async function initSupabaseSession() {
  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      let prof = null;
      try {
        const res = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        prof = res.data;
      } catch (_) {}
      currentSupabaseUser = {
        id: session.user.id,
        nome: prof?.nome || session.user.user_metadata?.nome || session.user.email.split('@')[0],
        email: session.user.email,
        tel: prof?.telefone || '',
        cargo: prof?.cargo || '',
        admin: prof?.is_admin || ADMIN_EMAILS.includes(session.user.email)
      };
      DB.setSession(session.user.id);
    }
  } catch (err) {
    console.warn('Erro ao restaurar sessão do Supabase:', err);
  }
  await fetchOrgsFromSupabase();
  await syncConnectionsAndMessages();
  renderAuthUI();
  refreshAllMaps();
}

function setupSupabaseRealtime() {
  if (!sb) return;
  try {
    sb.channel('realtime_inova')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, payload => {
        const m = payload.new;
        if (!m) return;
        const list = connections();
        const c = list.find(x => x.id === m.conexao_id);
        if (c) {
          if (!c.messages) c.messages = [];
          if (!c.messages.some(x => x.id === m.id)) {
            c.messages.push({
              id: m.id,
              sender: m.remetente_id,
              text: m.conteudo,
              created: m.created_at
            });
            LS.set('inova_connections', list);
            if (activeChatId === c.id) renderMessages();
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizacoes' }, () => {
        fetchOrgsFromSupabase();
      })
      .subscribe();
  } catch (e) {
    console.warn('Supabase Realtime subscription error:', e);
  }
}

/* ---------- 5) ROTAS (site x área logada) ---------- */
const VIEWS = {
  dashboard: 'Painel Geral',
  mapa: 'Mapa do Ecossistema',
  diagnostico: 'Diagnóstico de Inovação',
  nova: 'Organização',
  minhas: 'Minhas organizações',
  conexoes: 'Central de conexões',
  mensagens: 'Mensagens',
  moderacao: 'Moderação',
  perfil: 'Meu perfil'
};

function goApp(view = 'dashboard') {
  requireAuth(() => { location.hash = '#/app/' + view; route(); },
    view === 'nova' ? 'Para cadastrar uma organização, entre ou crie sua conta.' : 'Entre para acessar sua área.');
}

function route() {
  const m = location.hash.match(/^#\/app\/?(\w+)?/);
  if (m) {
    if (!user()) { location.hash = '#inicio'; return route(); }
    showApp(VIEWS[m[1]] ? m[1] : 'dashboard');
  } else {
    showSite();
    const id = location.hash.slice(1);
    setTimeout(() => id ? document.getElementById(id)?.scrollIntoView() : scrollTo(0, 0), 30);
  }
}
addEventListener('hashchange', route);

function showSite() {
  $('#app').hidden = true; $('#site').hidden = false;
  document.title = 'Camaçari INOVA';
  if (publicMapCtrl) {
    publicMapCtrl.invalidate();
    publicMapCtrl.refresh();
  }
  refreshIcons();
}

function showApp(view) {
  const u = user();
  $('#site').hidden = true; $('#app').hidden = false;
  $('#side').classList.remove('open'); $('#scrim').classList.remove('show');
  // data-view também identifica os links da navegação. Esconda somente as
  // páginas do painel para manter todas as opções do menu lateral visíveis.
  $$('.main > section[data-view]').forEach(s => s.hidden = s.dataset.view !== view);
  $$('#side nav button[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  $('#viewTitle').textContent = view === 'nova' && editingId ? 'Editar organização' : (VIEWS[view] || 'Painel');
  document.title = (VIEWS[view] || 'Painel') + ' · Camaçari INOVA';
  $('#navMod').hidden = !isAdmin(u);
  if (view === 'moderacao' && !isAdmin(u)) return goApp('dashboard');
  scrollTo(0, 0);

  const viewHandlers = {
    dashboard: renderDashboard,
    mapa: renderAppMap,
    diagnostico: renderAppDiag,
    nova: initForm,
    minhas: renderMine,
    conexoes: renderMatches,
    mensagens: renderMessages,
    moderacao: renderMod,
    perfil: renderProfile
  };

  if (viewHandlers[view]) {
    viewHandlers[view]();
  }
  renderAuthUI();
  refreshIcons();
}

/* ---------- 6) HEADER / MENUS ---------- */
const header = $('#header'), nav = $('#nav'), menuBtn = $('#menuBtn'), toTop = $('#toTop');

function renderAuthUI() {
  const u = user(), box = $('#navAuth');
  box.innerHTML = u
    ? `<button type="button" class="me-btn" data-action="app" data-view="dashboard"><span class="avatar">${esc(initials(u.nome))}</span>Meu painel</button>`
    : `<button type="button" class="btn btn-ghost btn-sm" data-action="login">Entrar</button>
       <button type="button" class="btn btn-lime btn-sm" data-action="register">Criar conta</button>`;
  if (u) {
    $('#sideAvatar').textContent = initials(u.nome);
    $('#sideName').textContent = u.nome;
    $('#sideRole').textContent = isAdmin(u) ? 'Moderador' : 'Conta';
    const pend = DB.orgs().filter(o => o.status === 'analise').length;
    $('#modCount').textContent = pend || '';
  }
}

menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
  header.classList.toggle('menu-open', open);
});
nav.addEventListener('click', e => {
  if (e.target.closest('a,button')) { nav.classList.remove('open'); header.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded', false); }
});
addEventListener('scroll', () => {
  header.classList.toggle('scrolled', scrollY > 40);
  toTop.classList.toggle('show', scrollY > 600);
}, { passive: true });
toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

const secObs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) $$('#nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]').forEach(s => secObs.observe(s));

const revObs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); revObs.unobserve(e.target); }
}), { threshold: .12 });
$$('.reveal').forEach(el => revObs.observe(el));

function countUp(el, to) {
  const dur = 1000, t0 = performance.now();
  (function tick(t) {
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

/* ---------- 7) AÇÕES DOS BOTÕES (data-action) ---------- */
const actions = {
  login: () => openAuth('login'),
  register: () => openAuth('register'),
  logout,
  app: el => { if (el.dataset.view === 'nova') editingId = null; goApp(el.dataset.view); },
  'new-org': () => { editingId = null; goApp('nova'); },
  site: el => { location.hash = '#' + el.dataset.target; route(); },
  close: el => el.closest('dialog').close(),
  tab: el => setTab(el.dataset.tab),
  help: () => $('#helpDlg').showModal(),
  'toggle-side': () => { $('#side').classList.toggle('open'); $('#scrim').classList.toggle('show'); },
  'areas-all': () => $$('#areasBox input').forEach(c => c.checked = true),
  'areas-none': () => $$('#areasBox input').forEach(c => c.checked = false),
  'cancel-form': () => { editingId = null; goApp('minhas'); },
  export: exportData,
  'delete-account': deleteAccount
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el); }
});
$$('dialog').forEach(d => d.addEventListener('mousedown', e => {
  if (e.target !== d) return;
  const r = d.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
}));

/* ---------- 8) ORGANIZAÇÕES: dados ---------- */
const publicOrgs = () => [
  ...(SHOW_DEMO ? DEMO : []),
  ...DB.orgs().filter(o => o.status === 'aprovada' && o.autoriza)
];
const myOrgs = () => DB.orgs().filter(o => o.ownerId === DB.session());

const pinIcon = cor => L.divIcon({ className: '', html: `<div class="pin" style="--c:${cor}"></div>`, iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -30] });

function popupHTML(o) {
  const t = TIPOS[o.tipo] || TIPOS.outro;
  const c = tags(o.comp).slice(0, 4).join(' · ');
  return `<b>${esc(o.nome)}</b><br><small>${esc(t.nome)} · ${esc(o.cidade)}</small>
    ${c ? `<p style="margin-top:6px;font-size:.88rem;color:#555">${esc(c)}</p>` : ''}
    <button type="button" class="pop-btn" data-detail="${esc(o.id)}">Ver detalhes</button>`;
}

/* ---------- 9) GERENCIADOR DE MAPAS (LEAFLET MULTI-INSTÂNCIA) ---------- */
function initMapComponent({ mapId, listId, searchId, chipsId }) {
  const container = document.getElementById(mapId);
  if (!container) return null;

  const m = L.map(mapId, { scrollWheelZoom: false }).setView([-12.6996, -38.3263], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; Colaboradores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(m);

  m.on('click', () => m.scrollWheelZoom.enable());
  container.addEventListener('mouseleave', () => m.scrollWheelZoom.disable());
  m.on('popupopen', e => {
    const b = e.popup.getElement().querySelector('[data-detail]');
    if (b) b.onclick = () => openOrg(b.dataset.detail);
  });

  const layer = L.layerGroup().addTo(m);
  const markers = new Map();
  let filtroTipo = 'todos', termo = '', firstFit = true;

  const chipsBox = document.getElementById(chipsId);
  if (chipsBox) {
    chipsBox.innerHTML = `<button type="button" class="on" data-t="todos">Todos</button>` +
      Object.entries(TIPOS).map(([k, v]) => `<button type="button" data-t="${k}" style="--c:${v.cor}"><i></i>${v.nome}</button>`).join('');
    chipsBox.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      chipsBox.querySelectorAll('button').forEach(c => c.classList.toggle('on', c === b));
      filtroTipo = b.dataset.t; refresh();
    });
  }

  const searchEl = document.getElementById(searchId);
  let deb;
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      clearTimeout(deb);
      deb = setTimeout(() => { termo = e.target.value; refresh(); }, 200);
    });
  }

  const listEl = document.getElementById(listId);
  if (listEl) {
    listEl.addEventListener('click', e => {
      const b = e.target.closest('.item'); if (!b) return;
      const o = publicOrgs().find(x => x.id === b.dataset.id);
      if (!o) return;
      const marker = markers.get(o.id);
      m.flyTo([o.lat, o.lng], 15, { duration: .8 });
      setTimeout(() => marker && marker.openPopup(), 850);
      listEl.querySelectorAll('.item').forEach(i => i.classList.toggle('sel', i.dataset.id === o.id));
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function refresh() {
    const t = termo.trim().toLowerCase();
    const lista = publicOrgs().filter(o =>
      (filtroTipo === 'todos' || o.tipo === filtroTipo) &&
      (!t || o.nome.toLowerCase().includes(t) || (o.comp || '').toLowerCase().includes(t))
    );
    layer.clearLayers();
    markers.clear();
    lista.forEach(o => {
      const marker = L.marker([o.lat, o.lng], { icon: pinIcon((TIPOS[o.tipo] || TIPOS.outro).cor), title: o.nome }).bindPopup(popupHTML(o));
      marker.on('click', () => {
        if (listEl) listEl.querySelectorAll('.item').forEach(i => i.classList.toggle('sel', i.dataset.id === o.id));
      });
      marker.addTo(layer);
      markers.set(o.id, marker);
    });
    if (lista.length) {
      m.fitBounds(L.latLngBounds(lista.map(o => [o.lat, o.lng])).pad(.3), { maxZoom: 13, animate: !firstFit });
    }
    firstFit = false;

    if (listEl) {
      listEl.innerHTML = lista.length
        ? lista.map(o => `<button class="item" type="button" data-id="${esc(o.id)}" style="--c:${(TIPOS[o.tipo] || TIPOS.outro).cor}"><b>${esc(o.nome)}</b><small>${esc((TIPOS[o.tipo] || TIPOS.outro).nome)} · ${esc(o.cidade)}</small></button>`).join('')
        : '<p class="empty">Nenhuma organização encontrada com esse filtro.</p>';
    }

    if (mapId === 'map') {
      const all = publicOrgs();
      const set = new Set(all.flatMap(o => tags(o.comp).map(x => x.toLowerCase())));
      [['statOrgs', all.length], ['statTipos', new Set(all.map(o => o.tipo)).size], ['statComp', set.size]]
        .forEach(([id, v]) => { const el = document.getElementById(id); if (el) countUp(el, v); });
    }
  }

  refresh();
  return { map: m, refresh, invalidate: () => setTimeout(() => m.invalidateSize(), 100) };
}

// Instâncias dos mapas
let publicMapCtrl = null;
let dashMapCtrl = null;
let fullAppMapCtrl = null;

function refreshAllMaps() {
  publicMapCtrl && publicMapCtrl.refresh();
  dashMapCtrl && dashMapCtrl.refresh();
  fullAppMapCtrl && fullAppMapCtrl.refresh();
}

/* ---------- 10) DETALHES DA ORGANIZAÇÃO (exige login) ---------- */
function openOrg(id) {
  requireAuth(() => showOrg(id), 'Para ver as informações completas da organização, entre na sua conta.');
}
function showOrg(id) {
  const o = [...DEMO, ...DB.orgs()].find(x => x.id === id);
  if (!o) return toast('Organização não encontrada.', true);
  const u = user(), dono = o.ownerId === u.id || isAdmin(u);
  const t = TIPOS[o.tipo] || TIPOS.outro;
  const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : '';
  const publico = o.demo || (o.autoriza && o.status === 'aprovada');
  $('#orgDlgTitle').textContent = o.nome;
  $('#orgDlgBody').innerHTML = `<dl class="dl">
    ${row('Tipo de ator', esc(t.nome))}
    ${dono && !o.demo ? row('Status', `<span class="status st-${o.status}">${STATUS[o.status]}</span>${o.motivo ? '<br>Motivo: ' + esc(o.motivo) : ''}`) : ''}
    ${row('Descrição institucional', esc(o.desc))}
    ${row('Palavras-chave', esc(o.comp))}
    ${row('Eu tenho', esc(o.rec))}
    ${row('Eu procuro', esc(o.dem))}
    ${row('Endereço', o.rua ? esc(`${o.rua}, ${o.numero} — ${o.bairro}, ${o.cidade} · CEP ${o.cep}`) : esc(o.cidade))}
    ${row('Área de atuação', esc((o.areas || []).join(', ')))}
    ${(dono || publico) ? row('Site', o.site ? `<a href="${esc(o.site)}" target="_blank" rel="noopener">${esc(o.site)}</a>` : '') : ''}
    ${(dono || publico) ? row('E-mail de contato', o.email ? `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>` : '') : ''}
    ${(dono || publico) ? row('LinkedIn', o.linkedin ? `<a href="${esc(o.linkedin)}" target="_blank" rel="noopener">${esc(o.linkedin)}</a>` : '') : ''}
    ${(dono || publico) ? row('Telefone para contato', o.telefone ? `<a href="tel:${esc(o.telefone)}">${esc(o.telefone)}</a>` : '') : ''}
    ${(dono || publico) ? row('Outros', o.outros ? esc(o.outros).replace(/\n/g, '<br>') : '') : ''}
    ${o.demo ? '<div><dd class="muted">Organização de exemplo validada pelo ecossistema.</dd></div>' : ''}
  </dl>`;
  $('#orgDlg').showModal();
}

/* ---------- 11) FORMULÁRIO DE ORGANIZAÇÃO ---------- */
const form = $('#orgForm'), steps = $$('.step', form);
let step = 0, editingId = null;

$('#f-tipo').innerHTML = '<option value="">Selecione…</option>' + Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${v.nome}</option>`).join('');
$('#f-tipo-cadastro').addEventListener('change', e => {
  const pessoa = e.target.value === 'pessoa';
  $('#juridicoFields').hidden = pessoa;
  $('#fNomeLabel').innerHTML = pessoa ? 'Nome completo <i>*</i>' : 'Nome da empresa ou instituição <i>*</i>';
});
$('#f-cnpj').addEventListener('input', e => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 14);
  let v = d;
  if (v.length > 2) v = v.slice(0, 2) + '.' + v.slice(2);
  if (d.length > 5) v = v.slice(0, 6) + '.' + v.slice(6);
  if (d.length > 8) v = v.slice(0, 10) + '/' + v.slice(10);
  if (d.length > 12) v = v.slice(0, 15) + '-' + v.slice(15);
  e.target.value = v;
});
$('#cidadesList').innerHTML = Object.keys(CIDADES).map(c => `<option value="${c}">`).join('');
$('#areasBox').innerHTML = Object.keys(CIDADES).map(c => `<label class="check"><input type="checkbox" name="areas" value="${esc(c)}"><span>${esc(c)}</span></label>`).join('');

const STEP_FIELDS = [['nome', 'tipo'], ['cep', 'numero', 'rua', 'bairro', 'cidade', 'areas'], ['desc'], ['site', 'email', 'linkedin', 'autoriza']];
const RULES = {
  nome:   v => v.trim().length >= 3 ? '' : 'Informe o nome da organização.',
  tipo:   v => v ? '' : 'Selecione o tipo de ator.',
  cep:    v => /^\d{5}-?\d{3}$/.test(v.trim()) ? '' : 'Informe um CEP válido (00000-000).',
  numero: v => v.trim() ? '' : 'Informe o número (ou S/N).',
  rua:    v => v.trim() ? '' : 'Informe a rua.',
  bairro: v => v.trim() ? '' : 'Informe o bairro.',
  cidade: v => v.trim() ? '' : 'Informe a cidade.',
  areas:  v => v.length ? '' : 'Selecione pelo menos uma cidade/região de atuação.',
  desc:   v => v.trim().length < 20 ? 'Descreva a organização em pelo menos 20 caracteres.' : v.trim().length > 600 ? 'A descrição deve ter no máximo 600 caracteres.' : '',
  site:   v => !v.trim() || isUrl(v.trim()) ? '' : 'Link inválido. Use o formato https://...',
  email:  v => !v.trim() || /^\S+@\S+\.\S+$/.test(v.trim()) ? '' : 'E-mail inválido.',
  linkedin: v => !v.trim() || isUrl(v.trim()) ? '' : 'Link inválido. Use o formato https://...',
  autoriza: v => v ? '' : 'Escolha uma das opções de autorização.'
};
const getVal = n => n === 'areas' ? $$('[name=areas]:checked', form).map(c => c.value)
                  : n === 'autoriza' ? ($('[name=autoriza]:checked', form)?.value || '')
                  : form.elements[n].value;

function setCreatableValues(name, values) {
  const field = $(`[data-creatable="${name}"]`, form);
  const hidden = form.elements[name];
  const items = [...new Set(values.map(value => value.trim()).filter(Boolean))];
  hidden.value = items.join(', ');
  field.querySelector('.creatable-tags').innerHTML = items.map((value, index) =>
    `<span class="creatable-tag">${esc(value)}<button type="button" data-remove-tag="${index}" aria-label="Remover ${esc(value)}">×</button></span>`
  ).join('');
  field.querySelectorAll('[data-remove-tag]').forEach(button => button.addEventListener('click', () => {
    items.splice(Number(button.dataset.removeTag), 1);
    setCreatableValues(name, items);
  }));
}

['comp', 'rec', 'dem'].forEach(name => {
  const input = $(`#f-${name}-input`);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = input.value.trim().replace(/,$/, '');
      if (value) setCreatableValues(name, [...tags(form.elements[name].value), value]);
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value) {
      const values = tags(form.elements[name].value);
      values.pop();
      setCreatableValues(name, values);
    }
  });
});

function setErr(n, msg) {
  const span = $(`[data-err="${n}"]`, form); if (!span) return;
  span.textContent = msg || '';
  span.closest('.field')?.classList.toggle('bad', !!msg);
}
function validateStep(i) {
  let first = null;
  STEP_FIELDS[i].forEach(n => { const m = RULES[n](getVal(n)); setErr(n, m); if (m && !first) first = n; });
  if (first) { const el = form.elements[first]; (el.length ? el[0] : el).focus?.(); }
  return !first;
}
function showStep(n) {
  step = n;
  steps.forEach((s, i) => s.hidden = i !== n);
  $('#fStepLbl').textContent = `Seção ${n + 1} de ${steps.length}`;
  $('#fBar').style.width = ((n + 1) / steps.length * 100) + '%';
  $('#fPrev').style.visibility = n ? 'visible' : 'hidden';
  $('#fNext').hidden = n === steps.length - 1;
  $('#fSubmit').hidden = n !== steps.length - 1;
  $('.main').scrollIntoView?.({ block: 'start' });
}
$('#fNext').addEventListener('click', () => { if (validateStep(step)) showStep(step + 1); });
$('#fPrev').addEventListener('click', () => showStep(step - 1));
form.addEventListener('input', e => { const n = e.target.name; if (n && RULES[n]) setErr(n, ''); });

$('#f-cep').addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
  e.target.value = v;
  if (v.length === 9) buscaCep(v.replace('-', ''));
});
async function buscaCep(cep) {
  const hint = $('#cepHint'); hint.textContent = 'Buscando endereço…';
  try {
    const j = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
    if (j.erro) { hint.textContent = 'CEP não encontrado. Preencha manualmente.'; return; }
    if (j.logradouro) form.elements.rua.value = j.logradouro;
    if (j.bairro) form.elements.bairro.value = j.bairro;
    if (j.localidade) form.elements.cidade.value = j.localidade;
    ['rua', 'bairro', 'cidade'].forEach(n => setErr(n, ''));
    const c = j.localidade && [...$$('[name=areas]', form)].find(x => x.value === j.localidade);
    if (c) c.checked = true;
    hint.textContent = 'Endereço preenchido com sucesso.';
  } catch { hint.textContent = 'Não foi possível buscar o CEP automaticamente.'; }
}

function initForm() {
  form.reset();
  ['comp', 'rec', 'dem'].forEach(name => setCreatableValues(name, []));
  $$('[data-err]', form).forEach(s => setErr(s.dataset.err, ''));
  $('#cepHint').textContent = '';
  const o = editingId ? DB.orgs().find(x => x.id === editingId) : null;
  $('#formTitle span').textContent = o ? `Editando: ${o.nome}` : 'Apresentação / Objetivo';
  $('#fSubmit').textContent = o ? 'Salvar alterações' : 'Enviar para análise';
  if (o) {
    form.elements.tipoCadastro.value = o.tipoCadastro || 'organizacao';
    $('#f-tipo-cadastro').dispatchEvent(new Event('change'));
    form.elements.razaoSocial.value = o.razaoSocial || '';
    form.elements.cnpj.value = o.cnpj || '';
    ['nome', 'tipo', 'cep', 'numero', 'rua', 'bairro', 'cidade', 'desc', 'site', 'email', 'linkedin', 'telefone', 'outros'].forEach(n => form.elements[n].value = o[n] || '');
    ['comp', 'rec', 'dem'].forEach(name => setCreatableValues(name, tags(o[name])));
    $$('[name=areas]', form).forEach(c => c.checked = (o.areas || []).includes(c.value));
    const r = $(`[name=autoriza][value=${o.autoriza ? 'sim' : 'nao'}]`, form); if (r) r.checked = true;
  }
  else { $('#f-tipo-cadastro').value = 'organizacao'; $('#f-tipo-cadastro').dispatchEvent(new Event('change')); }
  showStep(0);
}

async function geocode(d) {
  try {
    const params = new URLSearchParams({
      format: 'json',
      limit: '1',
      addressdetails: '1',
      countrycodes: 'br',
      street: `${d.numero} ${d.rua}`,
      postalcode: d.cep.replace(/\D/g, ''),
      city: d.cidade,
      state: 'Bahia',
      country: 'Brasil'
    });
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    const j = await r.json();
    if (j[0]) return { lat: +j[0].lat, lng: +j[0].lon };
    const address = `${d.numero}, ${d.rua}, ${d.cep}, ${d.bairro}, ${d.cidade}, Bahia, Brasil`;
    const fallbackParams = new URLSearchParams({ format: 'json', limit: '1', addressdetails: '1', countrycodes: 'br', q: address });
    const fallback = await fetch(`https://nominatim.openstreetmap.org/search?${fallbackParams}`);
    const matches = await fallback.json();
    if (matches[0]) return { lat: +matches[0].lat, lng: +matches[0].lon };
  } catch (err) {
    console.warn('Não foi possível geocodificar o endereço informado:', err);
  }
  const c = CIDADES[d.cidade] || CIDADES['Camaçari'];
  return { lat: c[0], lng: c[1] };
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  for (let i = 0; i < steps.length; i++) if (!validateStep(i)) return showStep(i);
  const btn = $('#fSubmit'); btn.disabled = true; const old = btn.textContent; btn.textContent = 'Salvando…';
  const d = {
    nome: getVal('nome').trim(), tipoCadastro: getVal('tipoCadastro'), razaoSocial: getVal('razaoSocial').trim(), cnpj: getVal('cnpj').trim(), tipo: getVal('tipo'), cep: getVal('cep').trim(), numero: getVal('numero').trim(),
    rua: getVal('rua').trim(), bairro: getVal('bairro').trim(), cidade: getVal('cidade').trim(), areas: getVal('areas'),
    desc: getVal('desc').trim(), comp: getVal('comp').trim(), rec: getVal('rec').trim(), dem: getVal('dem').trim(),
    site: getVal('site').trim(), email: getVal('email').trim(), linkedin: getVal('linkedin').trim(), telefone: getVal('telefone').trim(), outros: getVal('outros').trim(), autoriza: getVal('autoriza') === 'sim'
  };
  const geo = await geocode(d);
  const now = new Date().toISOString();
  const status = d.autoriza ? 'analise' : 'privada';

  try {
    if (sb && user()) {
      const payload = {
        nome: d.nome,
        tipo_cadastro: d.tipoCadastro,
        razao_social: d.razaoSocial,
        cnpj: d.cnpj,
        tipo: d.tipo,
        cep: d.cep,
        numero: d.numero,
        rua: d.rua,
        bairro: d.bairro,
        cidade: d.cidade,
        areas: d.areas,
        descricao: d.desc,
        competencias: d.comp,
        recursos: d.rec,
        demandas: d.dem,
        site: d.site,
        email: d.email,
        linkedin: d.linkedin,
        telefone_contato: d.telefone,
        outros_contato: d.outros,
        autoriza: d.autoriza,
        lat: geo.lat,
        lng: geo.lng,
        status,
        owner_id: user().id
      };
      let result;
      if (editingId && !editingId.startsWith('demo')) {
        result = await sb.from('organizacoes').update(payload).eq('id', editingId).select('*').single();
      } else {
        result = await sb.from('organizacoes').insert(payload).select('*').single();
      }
      if (result.error) throw result.error;
      if (!result.data) throw new Error('O Supabase não retornou a organização salva.');

      const saved = mapSupabaseOrg(result.data);
      const orgs = DB.orgs();
      const index = orgs.findIndex(o => o.id === saved.id);
      if (index >= 0) orgs[index] = saved;
      else orgs.push(saved);
      DB.saveOrgs(orgs);
    } else {
      const orgs = DB.orgs();
      if (editingId) {
        const index = orgs.findIndex(o => o.id === editingId);
        if (index >= 0) orgs[index] = { ...orgs[index], ...d, ...geo, status, motivo: '', atualizado: now };
      } else {
        orgs.push({ id: uid(), ownerId: DB.session(), ...d, ...geo, status, criado: now, atualizado: now });
      }
      DB.saveOrgs(orgs);
    }
  } catch (err) {
    console.warn('Erro ao salvar organização:', err);
    const detail = err && err.message ? ` ${err.message}` : '';
    toast(`Não foi possível salvar a organização.${detail}`, true);
    return;
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }

  toast(d.autoriza ? 'Organização enviada! Ela será analisada pela moderação.' : 'Organização salva no seu painel privado.');
  editingId = null;
  refreshAllMaps();
  goApp('minhas');
});

/* ---------- 12) PAINEL / DASHBOARD APRIMORADO ---------- */
function orgRow(o, mode) {
  const t = TIPOS[o.tipo] || TIPOS.outro;
  const dono = () => (DB.users().find(u => u.id === o.ownerId) || {}).nome || '—';
  const acts = [`<button type="button" data-do="ver" data-id="${o.id}"><i data-lucide="eye" class="ic"></i><span>Ver</span></button>`];
  if (mode === 'mine') {
    acts.push(
      `<button type="button" data-do="edit" data-id="${o.id}"><i data-lucide="edit-3" class="ic"></i><span>Editar</span></button>`,
      `<button type="button" class="del" data-do="del" data-id="${o.id}"><i data-lucide="trash-2" class="ic"></i><span>Excluir</span></button>`
    );
  }
  if (mode === 'mod') {
    if (o.status !== 'aprovada' && o.autoriza) {
      acts.push(`<button type="button" class="ok" data-do="aprovar" data-id="${o.id}"><i data-lucide="check" class="ic"></i><span>Aprovar</span></button>`);
    }
    if (o.status !== 'rejeitada') {
      acts.push(`<button type="button" class="del" data-do="rejeitar" data-id="${o.id}"><i data-lucide="x" class="ic"></i><span>Rejeitar</span></button>`);
    }
    acts.push(`<button type="button" class="del" data-do="del" data-id="${o.id}"><i data-lucide="trash-2" class="ic"></i><span>Excluir</span></button>`);
  }
  return `<div class="row">
    <div class="row-info">
      <div class="row-header-line">
        <span class="actor-tag" style="--c:${t.cor}"><i></i>${esc(t.nome)}</span>
        <span class="status st-${o.status}">${STATUS[o.status]}</span>
      </div>
      <h3 class="row-title">${esc(o.nome)}</h3>
      <small class="row-meta">${esc(o.cidade)} · Enviada em ${fmtDate(o.criado)}${mode !== 'mine' ? ' · por ' + esc(dono()) : ''}</small>
    </div>
    <div class="acts">${acts.join('')}</div>
  </div>`;
}

/* ---------- Conexões e solicitações de contato ---------- */
const connections = () => LS.get('inova_connections', []);
const orgViewButton = id => `<button type="button" class="btn btn-ghost-dark btn-sm connection-org-view" data-view-org="${esc(id)}"><i data-lucide="eye" class="ic"></i><span>Ver</span></button>`;
function renderMatches() {
  const mine = myOrgs();
  const needs = mine.flatMap(o => tags(o.dem).map(term => ({ term, source: o.nome })));
  const targets = DB.orgs().filter(o => o.status === 'aprovada' && o.autoriza)
    .filter(o => !mine.some(m => m.id === o.id));
  const found = targets.map(o => {
    const available = [...tags(o.rec), ...tags(o.comp)];
    const hits = needs.filter(n => available.some(a => {
      const x = n.term.toLocaleLowerCase('pt-BR'), y = a.toLocaleLowerCase('pt-BR');
      return x === y || (x.length > 4 && y.includes(x)) || (y.length > 4 && x.includes(y));
    }));
    return { o, hits: [...new Set(hits.map(h => h.term))] };
  }).filter(x => x.hits.length).sort((a, b) => b.hits.length - a.hits.length);
  const el = $('#matchList');
  const matchCards = found.map(({ o, hits }) => {
    const connection = connections().find(c => c.from === DB.session() && c.target === o.id);
    const status = connection?.status === 'aceita'
      ? '<span class="connection-status">Solicitação aceita</span>'
      : connection?.status === 'recusada'
        ? '<span class="connection-status connection-status-rejected">Solicitação recusada</span>'
        : '';
    const action = connection?.status === 'aceita'
      ? `<button type="button" class="btn btn-orange btn-sm" data-match-chat="${esc(connection.id)}">Acessar chat</button>`
      : connection?.status === 'recusada'
        ? ''
        : connection
        ? '<button type="button" class="btn btn-orange btn-sm" disabled>Solicitação enviada</button>'
        : `<button type="button" class="btn btn-orange btn-sm" data-connect="${esc(o.id)}">Solicitar contato</button>`;
    return `<article class="row"><div class="row-main"><div class="connection-org-line"><b>${esc(o.nome)}</b>${orgViewButton(o.id)}</div><small>${esc((TIPOS[o.tipo] || TIPOS.outro).nome)} · ${esc(o.cidade || 'Ecossistema')}</small><p>Compatibilidade: ${hits.map(esc).join(', ')}</p><small>Eu tenho: ${esc(o.rec || o.comp || 'Palavras-chave cadastradas')}</small></div><div class="row-actions ${connection ? 'connection-actions' : ''}">${status}${action}</div></article>`;
  });
  const incoming = connections().filter(c =>
    DB.orgs().some(o => o.id === c.target && o.ownerId === DB.session())
  );
  const incomingCards = incoming.map(c => {
    const org = DB.orgs().find(o => o.id === c.target);
    const requester = c.requesterName || DB.users().find(u => u.id === c.from)?.nome || 'Solicitante';
    const institution = [org.nome, TIPOS[org.tipo]?.nome, org.cidade].filter(Boolean).join(' · ');
    const actions = c.status === 'pendente'
      ? `<button type="button" class="btn btn-orange btn-sm" data-incoming-action="aceitar" data-id="${esc(c.id)}">Aceitar</button><button type="button" class="btn btn-danger btn-sm" data-incoming-action="recusar" data-id="${esc(c.id)}">Recusar</button>`
      : c.status === 'aceita'
        ? `<button type="button" class="btn btn-orange btn-sm" data-match-chat="${esc(c.id)}">Acessar chat</button>`
        : '';
    const status = c.status === 'aceita'
      ? '<span class="connection-status">Solicitação aceita</span>'
      : c.status === 'recusada'
        ? '<span class="connection-status connection-status-rejected">Solicitação recusada</span>'
        : '<span class="connection-status connection-status-pending">Solicitação recebida</span>';
    return `<article class="row"><div class="row-main"><b>${esc(requester)}</b><div class="connection-org-line"><small>${esc(institution)}</small>${orgViewButton(org.id)}</div></div><div class="row-actions connection-actions">${status}${actions}</div></article>`;
  });
  el.innerHTML = [
    incomingCards.length ? '<h3 class="connection-section-title">Solicitações recebidas</h3>' + incomingCards.join('') : '',
    matchCards.length ? '<h3 class="connection-section-title">Sugestões de conexão</h3>' + matchCards.join('') : ''
  ].filter(Boolean).join('') || '<div class="empty-box">Ainda não encontramos compatibilidades. Cadastre seus itens em “Eu procuro” para receber sugestões de organizações.</div>';
  refreshIcons();
  el.querySelectorAll('[data-view-org]').forEach(btn => btn.addEventListener('click', () => openOrg(btn.dataset.viewOrg)));
  el.querySelectorAll('[data-connect]').forEach(btn => btn.addEventListener('click', async () => {
    const targetId = btn.dataset.connect;
    let connId = uid();
    if (sb && user() && !targetId.startsWith('demo')) {
      try {
        const { data } = await sb.from('conexoes').insert({
          solicitante_id: user().id,
          organizacao_alvo_id: targetId,
          status: 'pendente'
        }).select().single();
        if (data?.id) connId = data.id;
      } catch (err) {
        console.warn('Erro ao salvar conexão no Supabase:', err);
      }
    }
    const list = connections();
    const target = DB.orgs().find(o => o.id === targetId) || {};
    list.push({
      id: connId,
      from: DB.session(),
      target: targetId,
      targetName: target.nome || '',
      targetTipo: target.tipo || '',
      targetCidade: target.cidade || '',
      requesterName: user()?.nome || '',
      created: new Date().toISOString(),
      status: 'pendente'
    });
    LS.set('inova_connections', list); toast('Solicitação de contato enviada.'); renderMatches();
  }));
  el.querySelectorAll('[data-match-chat]').forEach(btn => btn.addEventListener('click', () => {
    activeChatId = btn.dataset.matchChat;
    goApp('mensagens');
  }));
  el.querySelectorAll('[data-incoming-action]').forEach(btn => btn.addEventListener('click', async () => {
    const newStatus = btn.dataset.incomingAction === 'aceitar' ? 'aceita' : 'recusada';
    const connectionId = btn.dataset.id;
    if (sb && !connectionId.startsWith('demo')) {
      try {
        const { error } = await sb.from('conexoes').update({ status: newStatus }).eq('id', connectionId);
        if (error) {
          console.warn('Erro ao atualizar conexão no Supabase:', error);
          toast('Não foi possível atualizar a solicitação. Tente novamente.', true);
          return;
        }
      } catch (err) {
        console.warn('Erro ao atualizar conexão no Supabase:', err);
        toast('Não foi possível atualizar a solicitação. Tente novamente.', true);
        return;
      }
    }
    const updated = connections().map(c => c.id === connectionId ? { ...c, status: newStatus } : c);
    LS.set('inova_connections', updated);
    renderMatches();
    toast(newStatus === 'aceita' ? 'Conexão aceita. O chat está disponível.' : 'Solicitação recusada.');
  }));
}
let activeChatId = null;
function renderMessages() {
  const me = DB.session(), list = connections();
  const mine = list.filter(c =>
    c.status !== 'recusada' &&
    (c.from === me || DB.orgs().some(o => o.id === c.target && o.ownerId === me))
  );
  const el = $('#messageList');
  el.innerHTML = mine.length ? mine.map(c => {
    const target = DB.orgs().find(o => o.id === c.target) || {
      nome: c.targetName,
      tipo: c.targetTipo,
      cidade: c.targetCidade
    };
    const sender = DB.users().find(u => u.id === c.from) || {};
    const incoming = target.ownerId === me;
    const requesterName = c.requesterName || sender.nome || (c.from === user()?.id ? user().nome : '') || 'Solicitante';
    const peer = incoming ? requesterName : target.nome;
    const institution = [target.nome, TIPOS[target.tipo]?.nome, target.cidade].filter(Boolean).join(' · ');
    const actions = incoming && c.status === 'pendente'
      ? `<button type="button" class="btn btn-orange btn-sm" data-connection-action="aceitar" data-id="${esc(c.id)}">Aceitar</button><button type="button" class="btn btn-ghost-dark btn-sm" data-connection-action="recusar" data-id="${esc(c.id)}">Recusar</button>`
      : c.status === 'aceita'
        ? `<button type="button" class="btn ${activeChatId === c.id ? 'btn-orange' : 'btn-ghost-dark'} btn-sm" data-open-chat="${esc(c.id)}">Abrir chat</button><span class="connection-status">Conexão já realizada</span>`
        : `<small>${esc(c.status === 'recusada' ? 'Recusada' : 'Aguardando resposta')}</small>`;
    const statusLabel = c.status === 'pendente' ? (incoming ? 'Solicitação recebida' : 'Solicitação enviada') : '';
    const statusClass = c.status === 'aceita' ? 'connection-status' : c.status === 'recusada' ? 'connection-status connection-status-rejected' : '';
    return `<article class="row chat-contact ${activeChatId === c.id ? 'is-active' : ''}"><div class="row-main"><div class="connection-org-line"><b>${esc(peer || 'Organização')}</b>${orgViewButton(c.target)}</div><small>${esc(institution || 'Instituição')}</small>${statusLabel ? `<small class="${statusClass}">${esc(statusLabel)}</small>` : ''}</div><div class="row-actions ${c.status === 'aceita' || (incoming && c.status === 'pendente') ? 'connection-actions' : ''}">${actions}</div></article>`;
  }).join('') : '<div class="empty-box">Você ainda não tem solicitações. Encontre uma conexão na Central de conexões.</div>';

  refreshIcons();
  el.querySelectorAll('[data-view-org]').forEach(btn => btn.addEventListener('click', () => openOrg(btn.dataset.viewOrg)));
  el.querySelectorAll('[data-connection-action]').forEach(btn => btn.addEventListener('click', async () => {
    const action = btn.dataset.connectionAction;
    const newStatus = action === 'aceitar' ? 'aceita' : 'recusada';
    if (sb && !btn.dataset.id.startsWith('demo')) {
      try {
        const { error } = await sb.from('conexoes').update({ status: newStatus }).eq('id', btn.dataset.id);
        if (error) {
          console.warn('Erro ao atualizar conexão no Supabase:', error);
          toast('Não foi possível atualizar a solicitação. Tente novamente.', true);
          return;
        }
      } catch (err) {
        console.warn('Erro ao atualizar conexão no Supabase:', err);
        toast('Não foi possível atualizar a solicitação. Tente novamente.', true);
        return;
      }
    }
    const next = connections().map(c => c.id === btn.dataset.id ? { ...c, status: newStatus } : c);
    LS.set('inova_connections', next);
    if (action === 'aceitar') activeChatId = btn.dataset.id;
    renderMessages();
    toast(action === 'aceitar' ? 'Conexão aceita. O chat está disponível.' : 'Solicitação recusada.');
  }));
  el.querySelectorAll('[data-open-chat]').forEach(btn => btn.addEventListener('click', () => { activeChatId = btn.dataset.openChat; renderMessages(); }));

  const active = mine.find(c => c.id === activeChatId && c.status === 'aceita');
  const panel = $('#chatPanel');
  if (!active) {
    panel.innerHTML = '<div class="chat-placeholder">Selecione uma conexão aceita para abrir o chat.</div>';
    return;
  }
  const target = DB.orgs().find(o => o.id === active.target) || {
    nome: active.targetName,
    tipo: active.targetTipo,
    cidade: active.targetCidade
  };
  const sender = DB.users().find(u => u.id === active.from) || {};
  const incoming = target.ownerId === me;
  const requesterName = active.requesterName || sender.nome || (active.from === user()?.id ? user().nome : '') || 'Solicitante';
  const peerName = incoming ? requesterName : target.nome;
  const institution = [target.nome, TIPOS[target.tipo]?.nome, target.cidade].filter(Boolean).join(' · ');
  const messages = active.messages || [];
  panel.innerHTML = `<div class="chat-header"><div class="panel-tag">Chat da conexão</div><div class="chat-header-title"><h3>${esc(peerName || 'Organização')}</h3>${orgViewButton(active.target)}</div><p class="muted">${esc(institution || 'Instituição')}</p></div><div class="chat-feed" id="chatFeed">${messages.length ? messages.map(m => `<div class="chat-message ${m.sender === me ? 'mine' : ''}"><p>${esc(m.text)}</p><small>${fmtDate(m.created)} · ${m.sender === me ? 'Você' : esc(peerName || 'Solicitante')}</small></div>`).join('') : '<div class="chat-placeholder">Inicie a conversa com uma mensagem.</div>'}</div><form id="chatForm" class="chat-compose"><textarea name="message" maxlength="2000" rows="2" placeholder="Escreva sua mensagem…" required></textarea><button class="btn btn-orange" type="submit">Enviar</button></form>`;
  refreshIcons();
  panel.querySelector('[data-view-org]').addEventListener('click', event => openOrg(event.currentTarget.dataset.viewOrg));
  $('#chatForm').addEventListener('submit', async e => {
    e.preventDefault();
    const input = e.currentTarget.elements.message, text = input.value.trim();
    if (!text) return;
    const current = connections();
    const index = current.findIndex(c => c.id === active.id);
    if (index < 0) return;
    const msgId = uid(), now = new Date().toISOString();

    if (sb && user() && !active.id.startsWith('demo')) {
      try {
        await sb.from('mensagens').insert({
          conexao_id: active.id,
          remetente_id: user().id,
          conteudo: text
        });
      } catch (err) {
        console.warn('Erro ao enviar mensagem no Supabase:', err);
      }
    }

    current[index].messages = [...(current[index].messages || []), { id: msgId, sender: me, text, created: now }];
    LS.set('inova_connections', current); renderMessages();
    $('#chatFeed').scrollTop = $('#chatFeed').scrollHeight;
  });
  $('#chatFeed').scrollTop = $('#chatFeed').scrollHeight;
}

function renderDashboard() {
  const u = user(), mine = myOrgs();
  const hour = new Date().getHours();
  const saudacao = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  $('#dashGreetingTitle').textContent = `${saudacao}, ${u.nome.split(' ')[0]}!`;
  $('#dashHello').textContent = `Veja as conexões ativas no território e gerencie suas iniciativas de inovação em Camaçari.`;

  const c = s => mine.filter(o => o.status === s).length;
  const dg = LS.get('inova_diag_' + u.id, null);
  const diagLabel = dg ? `${dg.pct}% · ${dg.nivel}` : 'Pendente';

  const kpiCards = [
    { label: 'Organizações no mapa', val: publicOrgs().length, icon: 'map-pin', badge: 'Ecossistema', color: 'orange' },
    { label: 'Minhas organizações', val: mine.length, icon: 'building', badge: 'Cadastros', color: 'lime' },
    { label: 'Em análise da equipe', val: c('analise'), icon: 'clock', badge: 'Pendentes', color: 'amber' },
    { label: 'Maturidade de Inovação', val: diagLabel, icon: 'sparkles', badge: dg ? 'Avaliado' : 'Novo', color: 'emerald' }
  ];

  $('#kpis').innerHTML = kpiCards.map(k => `
    <div class="kpi kpi-${k.color}">
      <div class="kpi-top">
        <span class="kpi-icon"><i data-lucide="${k.icon}"></i></span>
        <span class="kpi-tag">${k.badge}</span>
      </div>
      <b class="kpi-val">${k.val}</b>
      <span class="kpi-label">${k.label}</span>
    </div>
  `).join('');

  // INICIALIZA / ATUALIZA O MAPA DIRETAMENTE NO PAINEL
  if (!dashMapCtrl) {
    dashMapCtrl = initMapComponent({
      mapId: 'dashMap',
      listId: 'dashList',
      searchId: 'dashSearchInput',
      chipsId: 'dashChips'
    });
  } else {
    dashMapCtrl.refresh();
  }
  dashMapCtrl && dashMapCtrl.invalidate();

  // WIDGET DE DIAGNÓSTICO DO PAINEL (COM ACESSO DIRETO SEM SAIR DO APP)
  $('#dashDiag').innerHTML = dg
    ? `<div class="panel-head-row">
         <div>
           <div class="panel-tag"><i data-lucide="sparkles" class="ic c-orange"></i> Diagnóstico Concluído</div>
           <h2 class="h2 first">Maturidade de Inovação: Nível ${esc(dg.nivel)}</h2>
           <p class="muted">Pontuação geral: <strong>${dg.pct}%</strong> · Realizado em ${fmtDate(dg.data)}.</p>
         </div>
         <button class="btn btn-ghost-dark btn-sm" type="button" data-action="app" data-view="diagnostico">Ver diagnóstico completo <i data-lucide="arrow-right" class="ic"></i></button>
       </div>`
    : `<div class="panel-head-row">
         <div>
           <div class="panel-tag"><i data-lucide="sparkles" class="ic c-orange"></i> Diagnóstico Recomendado</div>
           <h2 class="h2 first">Descubra a Maturidade da sua Organização</h2>
           <p class="muted">Responda a 8 perguntas objetivas e descubra pontos de atenção e oportunidades no ecossistema.</p>
         </div>
         <button class="btn btn-orange btn-sm" type="button" data-action="app" data-view="diagnostico">Fazer diagnóstico agora <i data-lucide="arrow-right" class="ic"></i></button>
       </div>`;

  const rec = [...mine].sort((a, b) => b.atualizado.localeCompare(a.atualizado)).slice(0, 3);
  $('#dashRecent').innerHTML = rec.length ? rec.map(o => orgRow(o, 'mine')).join('')
    : `<div class="empty-box">Você ainda não cadastrou nenhuma organização.<br><button class="btn btn-orange btn-sm" type="button" data-action="new-org">Cadastrar a primeira</button></div>`;

  refreshIcons();
}

function renderAppMap() {
  if (!fullAppMapCtrl) {
    fullAppMapCtrl = initMapComponent({
      mapId: 'appFullMap',
      listId: 'appMapList',
      searchId: 'appMapSearchInput',
      chipsId: 'appMapChips'
    });
  } else {
    fullAppMapCtrl.refresh();
  }
  fullAppMapCtrl && fullAppMapCtrl.invalidate();
}

function renderMine() {
  const mine = myOrgs();
  $('#myOrgs').innerHTML = mine.length ? mine.map(o => orgRow(o, 'mine')).join('')
    : `<div class="empty-box">Nenhuma organização cadastrada ainda.<br><button class="btn btn-orange btn-sm" type="button" data-action="new-org">Cadastrar organização</button></div>`;
}

function renderMod() {
  const all = DB.orgs();
  const pend = all.filter(o => o.status === 'analise');
  $('#modList').innerHTML = pend.length ? pend.map(o => orgRow(o, 'mod')).join('') : '<div class="empty-box">Nenhuma organização aguardando análise. </div>';
  $('#allOrgs').innerHTML = all.length ? all.map(o => orgRow(o, 'mod')).join('') : '<div class="empty-box">Nenhuma organização cadastrada.</div>';
  renderAuthUI();
}

$('#app').addEventListener('click', async e => {
  const b = e.target.closest('[data-do]'); if (!b) return;
  const id = b.dataset.id, orgs = DB.orgs(), o = orgs.find(x => x.id === id);
  const refresh = () => { const v = $$('[data-view]').find(s => !s.hidden).dataset.view; showApp(v); };
  switch (b.dataset.do) {
    case 'ver': showOrg(id); break;
    case 'edit': editingId = id; location.hash = '#/app/nova'; route(); break;
    case 'del':
      if (!confirm(`Excluir "${o.nome}"? Esta ação não pode ser desfeita.`)) return;
      if (sb && !id.startsWith('demo')) {
        try {
          const { error } = await sb.from('organizacoes').delete().eq('id', id);
          if (error) {
            console.warn('Erro ao excluir organização no Supabase:', error);
            return toast('Não foi possível excluir a organização. Tente novamente.', true);
          }
        } catch (err) {
          console.warn('Erro ao excluir organização no Supabase:', err);
          return toast('Não foi possível excluir a organização. Tente novamente.', true);
        }
      }
      DB.saveOrgs(orgs.filter(x => x.id !== id)); toast('Organização excluída.');
      refreshAllMaps(); refresh(); break;
    case 'aprovar':
      o.status = 'aprovada'; o.motivo = '';
      if (sb && !id.startsWith('demo')) {
        try { await sb.from('organizacoes').update({ status: 'aprovada', motivo_rejeicao: '' }).eq('id', id); } catch (_) {}
      }
      DB.saveOrgs(orgs); toast('Organização aprovada e publicada no mapa.');
      refreshAllMaps(); refresh(); break;
    case 'rejeitar': {
      const m = prompt('Motivo da rejeição (será exibido ao responsável):', '');
      if (m === null) return;
      o.status = 'rejeitada'; o.motivo = m.trim();
      if (sb && !id.startsWith('demo')) {
        try { await sb.from('organizacoes').update({ status: 'rejeitada', motivo_rejeicao: m.trim() }).eq('id', id); } catch (_) {}
      }
      DB.saveOrgs(orgs); toast('Organização rejeitada.');
      refreshAllMaps(); refresh(); break;
    }
  }
});

/* ---------- 13) PERFIL ---------- */
function renderProfile() {
  const u = user();
  $('#p-nome').value = u.nome; $('#p-email').value = u.email; $('#p-tel').value = u.tel || ''; $('#p-cargo').value = u.cargo || '';
  ['pw-old', 'pw-new', 'pw-new2'].forEach(i => $('#' + i).value = '');
}
$('#profForm').addEventListener('submit', async e => {
  e.preventDefault();
  const nome = $('#p-nome').value.trim();
  if (nome.length < 3) return toast('Informe seu nome completo.', true);
  const tel = $('#p-tel').value.trim(), cargo = $('#p-cargo').value.trim();
  if (sb && user()) {
    try {
      await sb.from('profiles').update({ nome, telefone: tel, cargo }).eq('id', user().id);
    } catch (_) {}
  }
  const users = DB.users(), u = users.find(x => x.id === DB.session());
  if (u) Object.assign(u, { nome, tel, cargo });
  if (currentSupabaseUser) Object.assign(currentSupabaseUser, { nome, tel, cargo });
  DB.saveUsers(users); renderAuthUI(); toast('Perfil atualizado com sucesso.');
});
$('#pwdForm').addEventListener('submit', async e => {
  e.preventDefault();
  const users = DB.users(), u = users.find(x => x.id === DB.session());
  const o = $('#pw-old').value, n = $('#pw-new').value, n2 = $('#pw-new2').value;
  if (n.length < 8) return toast('A nova senha deve ter pelo menos 8 caracteres.', true);
  if (n !== n2) return toast('As senhas novas não conferem.', true);
  if (sb && user()) {
    try {
      const { error } = await sb.auth.updateUser({ password: n });
      if (error) return toast(error.message, true);
    } catch (err) {
      return toast(err.message || 'Erro ao atualizar senha.', true);
    }
  }
  if (u) {
    if (u.hash && u.hash !== await hashPwd(o, u.salt)) return toast('Senha atual incorreta.', true);
    u.salt = uid(); u.hash = await hashPwd(n, u.salt);
    DB.saveUsers(users);
  }
  e.target.reset(); toast('Senha atualizada com sucesso.');
});
function exportData() {
  const u = user(); const { hash, salt, ...safe } = u;
  const blob = new Blob([JSON.stringify({ usuario: safe, organizacoes: myOrgs(), diagnostico: LS.get('inova_diag_' + u.id, null) }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'meus-dados-camacari-inova.json'; a.click();
  URL.revokeObjectURL(a.href); toast('Arquivo de dados baixado.');
}
async function deleteAccount() {
  if (!confirm('Excluir sua conta e todas as organizações cadastradas por ela? Esta ação não pode ser desfeita.')) return;
  const id = DB.session();
  if (sb && user()) {
    try {
      await sb.from('organizacoes').delete().eq('owner_id', id);
      await sb.from('profiles').delete().eq('id', id);
    } catch (_) {}
  }
  DB.saveOrgs(DB.orgs().filter(o => o.ownerId !== id));
  DB.saveUsers(DB.users().filter(u => u.id !== id));
  localStorage.removeItem('inova_diag_' + id);
  await logout(); toast('Conta excluída.');
}

/* ---------- 14) QUESTIONÁRIO DE DIAGNÓSTICO (CONTROLADOR UNIVERSAL) ---------- */
const DIMENSOES = {
  estrategia: 'Estratégia e liderança',
  pessoas: 'Pessoas e cultura',
  processos: 'Processos e projetos',
  parcerias: 'Parcerias e ecossistema'
};
const PERGUNTAS = [
  { d: 'estrategia', q: 'A inovação aparece no planejamento estratégico da sua organização?', o: ['Não aparece', 'Aparece em conversas informais', 'Há metas, mas sem acompanhamento', 'Há metas, orçamento e acompanhamento estruturado'] },
  { d: 'estrategia', q: 'Existe orçamento ou tempo reservado para inovar?', o: ['Nenhum', 'Apenas de forma pontual', 'Sim, mas limitado', 'Sim, de forma recorrente e planejado'] },
  { d: 'pessoas', q: 'Como a equipe participa da geração de ideias?', o: ['Não há espaço para isso', 'Ideias surgem, mas se perdem', 'Há canais para sugerir ideias', 'Há canais e as ideias são avaliadas e testadas com método'] },
  { d: 'pessoas', q: 'A equipe recebe capacitação em inovação e tecnologia?', o: ['Nunca', 'Raramente', 'Algumas vezes ao ano', 'Existe um plano contínuo de capacitação'] },
  { d: 'processos', q: 'Como vocês testam novas soluções?', o: ['Não testamos', 'Testamos direto no cliente/operação sem validação', 'Fazemos pilotos informais', 'Temos método estruturado (protótipos, pilotos, métricas)'] },
  { d: 'processos', q: 'Vocês medem os resultados dos projetos de inovação?', o: ['Não medimos', 'Medimos só o custo', 'Medimos alguns indicadores', 'Indicadores claros com revisão periódica'] },
  { d: 'parcerias', q: 'Com que frequência fazem parcerias com outras organizações?', o: ['Nunca', 'Já fizemos uma vez', 'De vez em quando', 'Constantemente colaboramos no ecossistema'] },
  { d: 'parcerias', q: 'Vocês conhecem quem pode apoiar no ecossistema local (universidades, empresas, fomento)?', o: ['Não conhecemos ninguém', 'Conhecemos poucos atores', 'Conhecemos vários, mas sem contato ativo', 'Temos relacionamento ativo e projetos conjuntos'] }
];
const NIVEIS = [
  { min: 0,  nome: 'Explorador', txt: 'Sua organização está começando a jornada. O foco agora é criar base e hábito.', dicas: ['Defina 1 desafio claro para resolver com inovação.', 'Reserve um tempo mensal para testar ideias com a equipe.', 'Cadastre sua organização e conheça quem já atua na região.'] },
  { min: 35, nome: 'Experimentador', txt: 'Já existem iniciativas, mas ainda sem constância. É hora de estruturar.', dicas: ['Crie um canal simples para coletar e priorizar ideias.', 'Escolha 2 indicadores objetivos para acompanhar seus pilotos.', 'Busque no mapa organizações com palavras-chave complementares.'] },
  { min: 65, nome: 'Estruturado', txt: 'Você já tem processos e cultura em desenvolvimento. O próximo passo é escalar conexões.', dicas: ['Formalize orçamento e metas claras de inovação.', 'Abra projetos conjuntos com universidades, centros de P&D ou startups.', 'Compartilhe seus casos de sucesso para atrair novos parceiros.'] },
  { min: 85, nome: 'Referência', txt: 'Sua organização é líder em inovação no território. Momento de acelerar parcerias.', dicas: ['Mentore e apoie organizações em estágios iniciais.', 'Lidere projetos colaborativos de alto impacto no ecossistema.', 'Mantenha “Eu tenho” e “Eu procuro” atualizados no mapa.'] }
];

function createQuizController({ stepId, barId, bodyId, prevId, nextId, quizBoxId, resultBoxId, isApp = false }) {
  let i = 0;
  let resp = Array(PERGUNTAS.length).fill(null);

  const stepEl = $('#' + stepId);
  const barEl = $('#' + barId);
  const bodyEl = $('#' + bodyId);
  const prevBtn = $('#' + prevId);
  const nextBtn = $('#' + nextId);
  const quizBox = $('#' + quizBoxId);
  const resultBox = $('#' + resultBoxId);

  if (!bodyEl) return null;

  function renderPergunta() {
    const p = PERGUNTAS[i], sel = resp[i];
    stepEl.textContent = `Pergunta ${i + 1} de ${PERGUNTAS.length}`;
    barEl.style.width = ((i + 1) / PERGUNTAS.length * 100) + '%';
    bodyEl.innerHTML = `<div class="fade"><h3 class="q-title">${esc(p.q)}</h3><div class="opts" role="radiogroup">` +
      p.o.map((t, k) => `<button type="button" class="opt ${sel === k ? 'sel' : ''}" role="radio" aria-checked="${sel === k}" data-k="${k}"><span class="dot"><svg><use href="#i-check"/></svg></span>${esc(t)}</button>`).join('') + `</div></div>`;
    prevBtn.style.visibility = i ? 'visible' : 'hidden';
    nextBtn.disabled = sel === null;
    nextBtn.innerHTML = (i === PERGUNTAS.length - 1 ? 'Ver resultado' : 'Próxima') + ' ' + ic('arrow');
  }

  bodyEl.addEventListener('click', e => {
    const b = e.target.closest('.opt'); if (!b) return;
    resp[i] = +b.dataset.k;
    bodyEl.querySelectorAll('.opt').forEach(o => { const on = o === b; o.classList.toggle('sel', on); o.setAttribute('aria-checked', on); });
    nextBtn.disabled = false;
  });

  nextBtn.addEventListener('click', () => {
    i < PERGUNTAS.length - 1 ? (i++, renderPergunta()) : mostrarResultado();
  });
  prevBtn.addEventListener('click', () => {
    if (i) { i--; renderPergunta(); }
  });

  function reset() {
    i = 0;
    resp.fill(null);
    quizBox.hidden = false;
    resultBox.hidden = true;
    renderPergunta();
  }

  function mostrarResultado() {
    const dim = {}, cnt = {};
    PERGUNTAS.forEach((p, idx) => { dim[p.d] = (dim[p.d] || 0) + resp[idx]; cnt[p.d] = (cnt[p.d] || 0) + 1; });
    const total = resp.reduce((a, b) => a + b, 0), pct = Math.round(total / (PERGUNTAS.length * 3) * 100);
    const nivel = [...NIVEIS].reverse().find(n => pct >= n.min);
    const menor = Object.keys(dim).sort((a, b) => dim[a] / cnt[a] - dim[b] / cnt[b])[0];

    quizBox.hidden = true;
    resultBox.hidden = false;

    const ringId = resultBoxId + 'Ring';
    const againBtnId = resultBoxId + 'Again';

    const actionBtns = isApp
      ? `<button class="btn btn-lime" type="button" data-action="app" data-view="mapa">Buscar parceiros no mapa</button>
         <button class="btn btn-ghost-dark" type="button" data-action="app" data-view="nova">Cadastrar organização</button>
         <button class="btn btn-ghost-dark" id="${againBtnId}" type="button">Refazer teste</button>`
      : `<a class="btn btn-lime" href="#mapa">Buscar parceiros no mapa</a>
         <button class="btn btn-ghost" type="button" data-action="new-org">Cadastrar organização</button>
         <button class="btn btn-ghost" id="${againBtnId}" type="button">Refazer teste</button>`;

    resultBox.innerHTML = `
      <div class="score-ring" id="${ringId}"><span>${pct}%</span></div>
      <p class="eyebrow">Seu nível</p><h3>${nivel.nome}</h3><p>${nivel.txt}</p>
      <div class="bars">${Object.keys(DIMENSOES).map(k => {
        const v = Math.round(dim[k] / (cnt[k] * 3) * 100);
        return `<div class="bar-row"><small><span>${DIMENSOES[k]}</span><span>${v}%</span></small><div class="bar"><div data-w="${v}"></div></div></div>`;
      }).join('')}</div>
      <p><strong>Ponto de atenção prioritário:</strong> ${DIMENSOES[menor]}.</p>
      <p style="margin-top:14px"><strong>Próximos passos recomendados:</strong></p>
      <ul>${nivel.dicas.map(d => `<li>${d}</li>`).join('')}</ul>
      <div class="actions">${actionBtns}</div>`;

    requestAnimationFrame(() => {
      const ring = document.getElementById(ringId);
      if (ring) ring.style.setProperty('--p', pct);
      resultBox.querySelectorAll('.bar div').forEach(b => b.style.width = b.dataset.w + '%');
    });

    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const againBtn = document.getElementById(againBtnId);
    if (againBtn) againBtn.onclick = () => reset();

    const u = user();
    const saveKey = 'inova_diag_' + (u ? u.id : 'guest');
    LS.set(saveKey, { pct, nivel: nivel.nome, data: new Date().toISOString(), menor, dim });
    if (sb && u) {
      try {
        sb.from('diagnosticos').insert({
          user_id: u.id,
          pontuacao_total: pct,
          nivel: nivel.nome,
          ponto_atencao: menor,
          dimensoes: dim
        }).then(() => {});
      } catch (_) {}
    }
    toast('Diagnóstico de inovação calculado e salvo!');
  }

  renderPergunta();
  return { reset, renderPergunta };
}

// Inicializa o Quiz da página inicial
const publicQuizCtrl = createQuizController({
  stepId: 'quizStep',
  barId: 'quizBar',
  bodyId: 'quizBody',
  prevId: 'prevBtn',
  nextId: 'nextBtn',
  quizBoxId: 'quiz',
  resultBoxId: 'result',
  isApp: false
});

// Inicializa o Quiz interno do Painel (Área logada)
let appQuizCtrl = null;
function renderAppDiag() {
  const u = user();
  const dg = LS.get('inova_diag_' + u.id, null);

  if (!appQuizCtrl) {
    appQuizCtrl = createQuizController({
      stepId: 'appQuizStep',
      barId: 'appQuizBar',
      bodyId: 'appQuizBody',
      prevId: 'appPrevBtn',
      nextId: 'appNextBtn',
      quizBoxId: 'appQuiz',
      resultBoxId: 'appResult',
      isApp: true
    });
  }

  // Se o usuário já tiver diagnóstico salvo, exibe o cartão de resultado com opção de refazer
  if (dg) {
    $('#appQuiz').hidden = true;
    const r = $('#appResult');
    r.hidden = false;
    const nivel = NIVEIS.find(n => n.nome === dg.nivel) || NIVEIS[0];
    r.innerHTML = `
      <div class="score-ring" id="appResultSavedRing"><span>${dg.pct}%</span></div>
      <p class="eyebrow">Diagnóstico Atual</p><h3>${dg.nivel}</h3><p>${nivel.txt}</p>
      <p style="margin-top:14px"><strong>Realizado em:</strong> ${fmtDate(dg.data)}</p>
      ${dg.menor ? `<p><strong>Ponto de atenção:</strong> ${DIMENSOES[dg.menor] || dg.menor}</p>` : ''}
      <p style="margin-top:14px"><strong>Próximos passos recomendados:</strong></p>
      <ul>${nivel.dicas.map(d => `<li>${d}</li>`).join('')}</ul>
      <div class="actions" style="margin-top:24px">
        <button class="btn btn-lime" type="button" data-action="app" data-view="mapa">Buscar parceiros no mapa</button>
        <button class="btn btn-ghost-dark" type="button" data-action="app" data-view="nova">Cadastrar organização</button>
        <button class="btn btn-orange" id="appRetakeBtn" type="button">Refazer diagnóstico</button>
      </div>`;

    requestAnimationFrame(() => {
      const ring = document.getElementById('appResultSavedRing');
      if (ring) ring.style.setProperty('--p', dg.pct);
    });

    const retake = document.getElementById('appRetakeBtn');
    if (retake) {
      retake.onclick = () => {
        appQuizCtrl.reset();
      };
    }
  } else {
    appQuizCtrl.reset();
  }
}

/* ---------- 15) CONTROLE DE TEMA (MODO ESCURO / CLARO) ---------- */
function initTheme() {
  const saved = LS.get('inova_theme', 'dark');
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeUI(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  LS.set('inova_theme', next);
  updateThemeUI(next);
  refreshIcons();
  toast(next === 'dark' ? 'Modo escuro ativado (descanso visual).' : 'Modo claro ativado.');
}

function updateThemeUI(theme) {
  const isDark = theme === 'dark';
  $$('.theme-toggle-btn').forEach(btn => {
    btn.title = isDark ? 'Alternar para modo claro' : 'Alternar para modo escuro';
    btn.setAttribute('aria-label', btn.title);
    const txt = btn.querySelector('.theme-text');
    if (txt) txt.textContent = isDark ? 'Modo Escuro' : 'Modo Claro';
  });
}

document.addEventListener('click', e => {
  const b = e.target.closest('#themeToggleBtn, #publicThemeToggleBtn');
  if (b) { e.preventDefault(); toggleTheme(); }
});

/* ---------- 16) MENU LATERAL RETRÁTIL (COLLAPSIBLE SIDEBAR) ---------- */
function initSidebarCollapse() {
  const btn = $('#sideCollapseBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      const app = $('#app');
      const isCollapsed = app.classList.toggle('side-collapsed');
      LS.set('inova_side_collapsed_v2', isCollapsed);
      setTimeout(() => {
        dashMapCtrl && dashMapCtrl.invalidate();
        fullAppMapCtrl && fullAppMapCtrl.invalidate();
      }, 320);
    });
  }
  if (LS.get('inova_side_collapsed_v2', false)) {
    $('#app').classList.add('side-collapsed');
  }
}

/* ---------- 17) INICIALIZAÇÃO GERAL ---------- */
initTheme();
initSidebarCollapse();

publicMapCtrl = initMapComponent({
  mapId: 'map',
  listId: 'list',
  searchId: 'searchInput',
  chipsId: 'chips'
});

renderAuthUI();
route();
refreshIcons();

// Inicializa a sessão e sincronização em tempo real do Supabase
initSupabaseSession();
setupSupabaseRealtime();
