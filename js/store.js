// Capa de datos conectada a Supabase (base de datos, usuarios y archivos).
// Las lecturas se hacen sobre una copia en memoria que se recarga en cada
// pantalla; las escrituras van directo a Supabase. Las reglas de seguridad
// (qué ve y qué puede cambiar cada usuario) están en supabase/schema.sql.

const CONFIGURADO = /^https?:\/\/.+/.test(CONFIG.supabaseUrl) && CONFIG.supabaseKey.length > 20;
const sb = CONFIGURADO ? supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) : null;
const BUCKET = 'archivos';

// Los clientes sin email entran con su DNI: internamente se les asigna este "email" que no existe
const DOMINIO_DNI = '@dni.invalid';
const soloDigitos = s => String(s ?? '').replace(/\D/g, '');
const emailDeDni = dni => soloDigitos(dni) + DOMINIO_DNI;
const entraConDni = u => !!u?.email?.endsWith(DOMINIO_DNI);
const usuarioVisible = u => entraConDni(u) ? 'DNI ' + u.email.replace(DOMINIO_DNI, '') : (u?.email || '');

// Lo que la persona escribe en "Email o DNI" → email de la cuenta
function emailDeIngreso(texto) {
  const t = String(texto || '').trim();
  return t.includes('@') ? t.toLowerCase() : emailDeDni(t);
}

function contrasenaAleatoria() {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(8)), n => letras[n % letras.length]).join('');
}
const TABLAS = { users: 'profiles', polizas: 'polizas', pagos: 'pagos', presupuestos: 'presupuestos', siniestros: 'siniestros' };

// Si se llega desde el email de "recuperar contraseña" hay que pedir la nueva clave
let ES_RECUPERO = location.hash.includes('type=recovery');
if (sb) sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') ES_RECUPERO = true; });

function hoyISO(offsetDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function sumarMeses(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(y, m - 1 + n, Math.min(d, 28));
  return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0');
}

const MENSAJES_ERROR = [
  [/already registered|already been registered|already exists/i, 'Ya existe un usuario con ese email'],
  [/Invalid login credentials/i, 'Email o contraseña incorrectos'],
  [/Email not confirmed/i, 'Tenés que confirmar tu email antes de ingresar (revisá tu casilla)'],
  [/Password should be at least/i, 'La contraseña debe tener al menos 6 caracteres'],
  [/row-level security|permission denied/i, 'No tenés permiso para hacer esto'],
  [/Failed to fetch|NetworkError/i, 'No hay conexión con el servidor. Revisá tu internet.'],
  [/rate limit/i, 'Demasiados intentos. Esperá unos minutos y probá de nuevo.'],
];

function fallo(error) {
  const msg = error?.message || String(error);
  const traducido = MENSAJES_ERROR.find(([re]) => re.test(msg));
  return new Error(traducido ? traducido[1] : msg);
}

const DB = {
  _d: { users: [], polizas: [], pagos: [], presupuestos: [], siniestros: [] },

  // Trae todo lo que el usuario actual puede ver (el productor ve todo, el cliente solo lo suyo)
  async cargar() {
    const cols = Object.keys(TABLAS);
    const res = await Promise.all(cols.map(c => sb.from(TABLAS[c]).select('*').limit(10000)));
    res.forEach((r, i) => { if (r.error) throw fallo(r.error); this._d[cols[i]] = r.data; });
    if (Auth.user?.role === 'admin') {
      const { data, error } = await sb.from('notas').select('*');
      if (error) throw fallo(error);
      const notas = Object.fromEntries(data.map(n => [n.clienteId, n.texto]));
      this._d.users.forEach(u => { u.notas = notas[u.id] || ''; });
    }
  },

  all(col) { return [...this._d[col]]; },
  get(col, id) { return this._d[col].find(x => x.id === id) || null; },
  where(col, fn) { return this._d[col].filter(fn); },

  async insert(col, obj) {
    const { data, error } = await sb.from(TABLAS[col]).insert(obj).select().single();
    if (error) throw fallo(error);
    this._d[col].push(data);
    return data;
  },

  async insertMany(col, lista) {
    if (!lista.length) return [];
    const { data, error } = await sb.from(TABLAS[col]).insert(lista).select();
    if (error) throw fallo(error);
    this._d[col].push(...data);
    return data;
  },

  async update(col, id, patch) {
    patch = { ...patch };
    if (col === 'users' && 'notas' in patch) {
      const { error } = await sb.from('notas').upsert({ clienteId: id, texto: patch.notas });
      if (error) throw fallo(error);
      delete patch.notas;
      if (!Object.keys(patch).length) return this.get(col, id);
    }
    const { data, error } = await sb.from(TABLAS[col]).update(patch).eq('id', id).select().single();
    if (error) throw fallo(error);
    return Object.assign(this.get(col, id) || {}, data);
  },

  async updateWhere(col, campo, valor, patch) {
    const { error } = await sb.from(TABLAS[col]).update(patch).eq(campo, valor);
    if (error) throw fallo(error);
    this._d[col].filter(x => x[campo] === valor).forEach(x => Object.assign(x, patch));
  },

  async remove(col, id) {
    const { error } = col === 'users'
      ? await sb.rpc('admin_borrar_usuario', { p_usuario: id })  // borra también la cuenta de ingreso
      : await sb.from(TABLAS[col]).delete().eq('id', id);
    if (error) throw fallo(error);
    this._d[col] = this._d[col].filter(x => x.id !== id);
  },

  // Formulario público: el visitante no puede leer la tabla, solo insertar
  async pedirPresupuestoPublico(datos) {
    const { error } = await sb.from('presupuestos').insert({ ...datos, clienteId: null, estado: 'nuevo' });
    if (error) throw fallo(error);
  },

  exportar() {
    const d = { exportado: new Date().toISOString(), ...this._d };
    return JSON.stringify(d, null, 2);
  },
};

// ---------- Archivos ----------

const Archivos = {
  // Sube un archivo a la carpeta del cliente y devuelve la referencia que se guarda en la tabla
  async subir(file, clienteId) {
    const limpio = file.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
    const path = `${clienteId || 'publico'}/${Date.now()}-${limpio}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
    if (error) throw fallo(error);
    return { nombre: file.name, tipo: file.type, path };
  },

  async bajar(archivo) {
    const { data, error } = await sb.storage.from(BUCKET).download(archivo.path);
    if (error) throw fallo(error);
    return data;
  },
};

// ---------- Usuarios ----------

async function perfil(id) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw fallo(error);
  return data;
}

const Auth = {
  user: null,

  async login(usuario, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email: emailDeIngreso(usuario), password });
    if (error) throw fallo(error);
    const p = await perfil(data.user.id);
    if (!p || p.bloqueado) {
      await sb.auth.signOut();
      throw new Error(p ? 'Tu cuenta está deshabilitada. Comunicate con tu productor.' : 'Tu usuario no tiene un perfil asignado. Comunicate con tu productor.');
    }
    return (this.user = p);
  },

  async current() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    return (this.user = await perfil(session.user.id));
  },

  async require(role) {
    const u = await this.current().catch(() => null);
    if (!u || u.role !== role || u.bloqueado) {
      if (u) await sb.auth.signOut();
      location.href = 'login.html';
      throw new Error('Sin sesión');
    }
    return u;
  },

  async logout() {
    await sb.auth.signOut();
    location.href = 'login.html';
  },

  // Cambia la contraseña del usuario que está logueado
  async setPassword(password) {
    if (!password || password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw fallo(error);
  },

  async checkPassword(password) {
    const { error } = await sb.auth.signInWithPassword({ email: this.user.email, password });
    return !error;
  },

  async cambiarEmail(email) {
    const { error } = await sb.auth.updateUser({ email: email.trim() }, { emailRedirectTo: urlLogin() });
    if (error) throw fallo(error);
  },

  // El productor crea la cuenta del cliente: con su email o, si no tiene, con su DNI. Devuelve el id.
  async crearCliente(datos, password) {
    const email = datos.email?.trim() ? datos.email.trim().toLowerCase() : soloDigitos(datos.dni).length >= 6 ? emailDeDni(datos.dni) : '';
    if (!email) throw new Error(`${datos.nombre || 'El cliente'}: hace falta un email o un DNI para que pueda ingresar`);
    const { data, error } = await sb.rpc('admin_crear_usuario', { p_email: email, p_password: password, p_datos: { ...datos, email } });
    if (error) throw fallo(error);
    return data;
  },

  // El productor le pone una contraseña nueva a un cliente
  async cambiarPasswordDe(id, password) {
    const { error } = await sb.rpc('admin_cambiar_password', { p_usuario: id, p_password: password });
    if (error) throw fallo(error);
  },

  async enviarRecupero(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlLogin() });
    if (error) throw fallo(error);
  },
};

function urlLogin() {
  return location.href.replace(/[^/]*([?#].*)?$/, 'login.html');
}
