// Capa de datos. Hoy guarda todo en el navegador (localStorage) para poder
// probar el sistema sin servidor. Para usarlo en producción con varios
// dispositivos hay que reemplazar este archivo por uno que hable con una base
// de datos real (por ej. Supabase o Firebase) manteniendo las mismas funciones.

const DB_KEY = 'pas_db_v1';
const SESSION_KEY = 'pas_session';
const COLECCIONES = ['users', 'polizas', 'pagos', 'presupuestos', 'siniestros'];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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

async function hashPassword(pass, salt) {
  const data = new TextEncoder().encode(salt + ':' + pass);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const DB = {
  _d: null,

  async init() {
    try { this._d = JSON.parse(localStorage.getItem(DB_KEY)); } catch { this._d = null; }
    if (!this._d) await this.seed();
    COLECCIONES.forEach(c => { this._d[c] = this._d[c] || []; });
  },

  save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this._d));
    } catch {
      this._d = JSON.parse(localStorage.getItem(DB_KEY));
      throw new Error('No hay espacio suficiente para guardar. Probá con un archivo más liviano.');
    }
  },

  all(col) { return [...this._d[col]]; },
  get(col, id) { return this._d[col].find(x => x.id === id) || null; },
  where(col, fn) { return this._d[col].filter(fn); },

  insert(col, obj) {
    const item = { id: uid(), creado: new Date().toISOString(), ...obj };
    this._d[col].push(item);
    this.save();
    return item;
  },

  update(col, id, patch) {
    const item = this.get(col, id);
    if (!item) throw new Error('Registro no encontrado');
    Object.assign(item, patch);
    this.save();
    return item;
  },

  remove(col, id) {
    this._d[col] = this._d[col].filter(x => x.id !== id);
    this.save();
  },

  exportar() { return JSON.stringify(this._d, null, 2); },

  importar(json) {
    const d = JSON.parse(json);
    if (!d || !Array.isArray(d.users)) throw new Error('El archivo no es una copia de seguridad válida');
    this._d = d;
    COLECCIONES.forEach(c => { this._d[c] = this._d[c] || []; });
    this.save();
  },

  async seed() {
    this._d = { users: [], polizas: [], pagos: [], presupuestos: [], siniestros: [] };
    const admin = await crearUsuario({ role: 'admin', nombre: CONFIG.marca, email: 'admin@demo.com' }, 'admin123', false);
    const cli = await crearUsuario({
      role: 'cliente', nombre: 'Juan Pérez', dni: '30123456', email: 'cliente@demo.com',
      telefono: '11 5555-1234', direccion: 'Av. Siempreviva 742, CABA',
    }, 'cliente123', false);

    const desde = sumarMeses(hoyISO(), -3);
    const auto = { id: uid(), creado: new Date().toISOString(), clienteId: cli.id, ramo: 'Auto', compania: 'Sancor', numero: 'AU-104582',
      bien: 'Volkswagen Gol Trend 2019 - Patente AB123CD', cobertura: 'Terceros completo con granizo',
      vigenciaDesde: desde, vigenciaHasta: sumarMeses(desde, 12), prima: 38500, suma: 9500000, estado: 'activa', archivo: null };
    const hogar = { id: uid(), creado: new Date().toISOString(), clienteId: cli.id, ramo: 'Hogar', compania: 'La Segunda', numero: 'HO-88213',
      bien: 'Departamento - Av. Siempreviva 742, CABA', cobertura: 'Integral de consorcio y contenido',
      vigenciaDesde: sumarMeses(hoyISO(), -11), vigenciaHasta: hoyISO(20), prima: 12900, suma: 25000000, estado: 'activa', archivo: null };
    this._d.polizas.push(auto, hogar);
    [auto, hogar].forEach(p => {
      for (let i = 0; i < 4; i++) {
        const venc = sumarMeses(p.vigenciaDesde, i);
        const pagado = venc < hoyISO(-25);
        this._d.pagos.push({ id: uid(), creado: new Date().toISOString(), polizaId: p.id, clienteId: cli.id, periodo: `Cuota ${i + 1}`,
          monto: p.prima, vencimiento: venc, estado: pagado ? 'pagado' : 'pendiente', fechaPago: pagado ? venc : null,
          medio: pagado ? 'Débito automático' : null, comprobante: null });
      }
    });
    this._d.presupuestos.push({ id: uid(), creado: new Date().toISOString(), clienteId: null, nombre: 'María Gómez', email: 'maria@ejemplo.com',
      telefono: '11 4444-9876', ramo: 'Auto', detalle: 'Quiero cotizar un Fiat Cronos 2022, uso particular, CABA.', estado: 'nuevo' });
    this.save();
    return admin;
  },
};

async function crearUsuario(datos, password, guardar = true) {
  const email = datos.email.trim().toLowerCase();
  if (DB._d.users.some(u => u.email === email)) throw new Error('Ya existe un usuario con ese email');
  const salt = uid();
  const user = { id: uid(), creado: new Date().toISOString(), ...datos, email, salt, passHash: await hashPassword(password, salt) };
  DB._d.users.push(user);
  if (guardar) DB.save();
  return user;
}

const Auth = {
  async login(email, password) {
    const u = DB._d.users.find(x => x.email === email.trim().toLowerCase());
    if (!u || u.passHash !== await hashPassword(password, u.salt)) throw new Error('Email o contraseña incorrectos');
    if (u.bloqueado) throw new Error('Tu cuenta está deshabilitada. Comunicate con tu productor.');
    sessionStorage.setItem(SESSION_KEY, u.id);
    return u;
  },
  current() {
    const id = sessionStorage.getItem(SESSION_KEY);
    return id ? DB.get('users', id) : null;
  },
  require(role) {
    const u = this.current();
    if (!u || u.role !== role) { location.href = 'login.html'; throw new Error('Sin sesión'); }
    return u;
  },
  logout() {
    sessionStorage.removeItem(SESSION_KEY);
    location.href = 'login.html';
  },
  async setPassword(userId, password) {
    if (!password || password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
    const salt = uid();
    DB.update('users', userId, { salt, passHash: await hashPassword(password, salt) });
  },
  async checkPassword(user, password) {
    return user.passHash === await hashPassword(password, user.salt);
  },
};
