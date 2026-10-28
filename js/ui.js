// Utilidades de interfaz compartidas por el panel del productor y el portal del cliente.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(+n || 0);

function fdate(d) {
  if (!d) return '-';
  const f = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  return f.toLocaleDateString('es-AR');
}

const MAX_ARCHIVO = 10 * 1024 * 1024;

// Devuelve el archivo elegido en un <input type=file> (o null) validando el tamaño
function archivoElegido(file) {
  if (!file || !file.size) return null;
  if (file.size > MAX_ARCHIVO) throw new Error('El archivo supera 10 MB. Probá comprimirlo.');
  return file;
}

async function subirSiHay(file, clienteId) {
  const f = archivoElegido(file);
  return f ? Archivos.subir(f, clienteId) : null;
}

async function descargar(archivo) {
  if (!archivo) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await Archivos.bajar(archivo));
  a.download = archivo.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// Abre el archivo en una pestaña nueva: en el celular se ve directo, sin descargarlo.
// La pestaña se abre antes de esperar la descarga para que el navegador no la bloquee.
async function verArchivo(archivo) {
  if (!archivo) return;
  const w = window.open('', '_blank');
  try {
    const datos = await Archivos.bajar(archivo);
    const url = URL.createObjectURL(new Blob([datos], { type: archivo.tipo || datos.type || 'application/pdf' }));
    if (w) w.location.href = url; else location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    if (w) w.close();
    throw err;
  }
}

function toast(msg, tipo = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + tipo;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

function modal(titulo, html, onSubmit, textoBoton = 'Guardar') {
  const wrap = document.createElement('div');
  wrap.className = 'modal-bg';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <header><h3>${esc(titulo)}</h3><button class="x" type="button" aria-label="Cerrar">×</button></header>
    <form novalidate>${html}
      <footer>
        <button type="button" class="btn ghost cancel">${onSubmit ? 'Cancelar' : 'Cerrar'}</button>
        ${onSubmit ? `<button class="btn" type="submit">${esc(textoBoton)}</button>` : ''}
      </footer>
    </form></div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  $('.x', wrap).onclick = close;
  $('.cancel', wrap).onclick = close;
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  const form = $('form', wrap);
  form.onsubmit = async e => {
    e.preventDefault();
    if (!onSubmit) return close();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    const btn = $('[type=submit]', form);
    btn.disabled = true;
    try {
      if (await onSubmit(data, form) !== false) close();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  };
  const first = $('input:not([type=hidden]), select, textarea', form);
  if (first) first.focus();
  return { wrap, form, close };
}

function confirmar(msg) { return window.confirm(msg); }

// Campos de formulario
function campo(label, name, { type = 'text', value = '', required = false, options = null, attrs = '', full = false, hint = '' } = {}) {
  const req = required ? 'required' : '';
  let input;
  if (options) {
    input = `<select name="${name}" ${req} ${attrs}>${options.map(o => {
      const [v, t] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(t)}</option>`;
    }).join('')}</select>`;
  } else if (type === 'textarea') {
    input = `<textarea name="${name}" rows="4" ${req} ${attrs}>${esc(value)}</textarea>`;
  } else {
    input = `<input type="${type}" name="${name}" value="${type === 'file' ? '' : esc(value)}" ${req} ${attrs}>`;
  }
  return `<label class="field ${full ? 'full' : ''}"><span>${esc(label)}${required ? ' *' : ''}</span>${input}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

// Estados calculados
function estadoPago(p) {
  if (p.estado === 'pagado' || p.estado === 'informado') return p.estado;
  return p.vencimiento < hoyISO() ? 'vencido' : 'pendiente';
}

function estadoPoliza(p) {
  if (p.estado === 'anulada') return 'anulada';
  if (p.vigenciaHasta < hoyISO()) return 'vencida';
  if (p.vigenciaHasta <= hoyISO(30)) return 'por vencer';
  return 'vigente';
}

const BADGES = {
  pagado: 'green', vigente: 'green', activo: 'green', deshabilitado: 'red', respondido: 'blue', aceptado: 'green', resuelto: 'green',
  pendiente: 'amber', 'por vencer': 'amber', informado: 'blue', nuevo: 'amber', 'en trámite': 'blue', denunciado: 'amber',
  reconocido: 'green', elegido: 'green', subido: 'green', 'sin asignar': 'amber', 'subiendo…': 'blue', 'ya existe': 'gray', error: 'red',
  vencido: 'red', vencida: 'red', anulada: 'gray', cerrado: 'gray', rechazado: 'red', rechazada: 'gray',
};
const badge = e => `<span class="badge ${BADGES[e] || 'gray'}">${esc(e)}</span>`;

function tabla(columnas, filas, vacio = 'No hay registros todavía.') {
  if (!filas.length) return `<div class="empty">${esc(vacio)}</div>`;
  return `<div class="table-wrap"><table><thead><tr>${columnas.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(f => `<tr>${f.map((c, i) => `<td data-label="${esc(columnas[i])}"><div>${c}</div></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// Certificado de cobertura imprimible (se puede guardar como PDF desde el navegador)
function imprimirCertificado(p, cliente) {
  const w = window.open('', '_blank');
  if (!w) return toast('Habilitá las ventanas emergentes para descargar el certificado', 'error');
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Certificado ${esc(p.numero)}</title>
  <style>body{font-family:Arial,sans-serif;max-width:720px;margin:40px auto;color:#1e293b;padding:0 20px}
  h1{font-size:22px;margin:0}header{display:flex;justify-content:space-between;border-bottom:3px solid #1d4ed8;padding-bottom:12px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin:16px 0}td{padding:8px;border-bottom:1px solid #e2e8f0}td:first-child{font-weight:bold;width:40%}
  .foot{margin-top:40px;font-size:12px;color:#64748b}@media print{button{display:none}}</style></head><body>
  <header><div><h1>${esc(CONFIG.marca)}</h1><div>${esc(CONFIG.productor)} · ${esc(CONFIG.matricula)}</div></div>
  <div style="text-align:right">${esc(CONFIG.telefono)}<br>${esc(CONFIG.email)}</div></header>
  <h2>Certificado de cobertura</h2>
  <p>Se certifica que el asegurado detallado a continuación posee cobertura vigente según los datos de la póliza:</p>
  <table>
    <tr><td>Asegurado</td><td>${esc(cliente?.nombre)}</td></tr>
    <tr><td>DNI / CUIT</td><td>${esc(cliente?.dni || '-')}</td></tr>
    <tr><td>Compañía</td><td>${esc(p.compania)}</td></tr>
    <tr><td>Ramo</td><td>${esc(p.ramo)}</td></tr>
    <tr><td>N° de póliza</td><td>${esc(p.numero)}</td></tr>
    <tr><td>Bien asegurado</td><td>${esc(p.bien)}</td></tr>
    <tr><td>Cobertura</td><td>${esc(p.cobertura || '-')}</td></tr>
    <tr><td>Suma asegurada</td><td>${money(p.suma)}</td></tr>
    <tr><td>Vigencia</td><td>${fdate(p.vigenciaDesde)} al ${fdate(p.vigenciaHasta)}</td></tr>
    <tr><td>Estado</td><td>${esc(estadoPoliza(p))}</td></tr>
  </table>
  <p class="foot">Emitido el ${new Date().toLocaleDateString('es-AR')}. Este certificado es informativo; las condiciones de cobertura son las establecidas en la póliza emitida por la compañía aseguradora.</p>
  <button onclick="print()">Imprimir / Guardar PDF</button>
  <script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}

function linkWhatsapp(tel, texto = '') {
  const num = String(tel || '').replace(/\D/g, '');
  return num ? `https://wa.me/${num}${texto ? '?text=' + encodeURIComponent(texto) : ''}` : null;
}

// Router por hash compartido
// `antes` se ejecuta antes de cada pantalla (recarga los datos del servidor)
function iniciarRouter(rutas, porDefecto, antes) {
  let ultima = '';
  const render = async () => {
    const [r, id] = location.hash.slice(1).split('/');
    const ruta = rutas[r] ? r : porDefecto;
    $$('.nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + ruta));
    document.body.classList.remove('menu-open');
    try {
      if (antes) await antes();
      rutas[ruta](id ? decodeURIComponent(id) : undefined);
    } catch (err) {
      $('#view').innerHTML = `<div class="empty">No se pudieron cargar los datos: ${esc(err.message)}<br><br><button class="btn" onclick="location.reload()">Reintentar</button></div>`;
    }
    if (location.hash !== ultima) window.scrollTo(0, 0);
    ultima = location.hash;
  };
  window.addEventListener('hashchange', render);
  render();
  return render;
}

// Conecta los botones con data-act a las funciones de `acciones`
function conectarAcciones(acciones) {
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el || !acciones[el.dataset.act]) return;
    e.preventDefault();
    try { await acciones[el.dataset.act](el.dataset.id, el); }
    catch (err) { toast(err.message, 'error'); }
  });
}

function pantallaSinConfigurar() {
  document.body.innerHTML = `<div class="auth-page"><div class="auth-card"><h1>Falta conectar la base de datos</h1>
    <p>Completá <code>supabaseUrl</code> y <code>supabaseKey</code> en <code>js/config.js</code>. Los pasos están en <code>SUPABASE.md</code>.</p></div></div>`;
}
