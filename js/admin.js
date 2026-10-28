// Panel del productor de seguros

let yo, refrescar;
const view = () => $('#view');
const MEDIOS = ['Transferencia', 'Efectivo', 'Débito automático', 'Tarjeta de crédito', 'Mercado Pago', 'Pago Fácil / Rapipago', 'Otro'];
const ESTADOS_SINIESTRO = ['denunciado', 'en trámite', 'resuelto', 'rechazado'];

const clientes = () => DB.where('users', u => u.role === 'cliente').sort((a, b) => a.nombre.localeCompare(b.nombre));
const nombreCliente = id => DB.get('users', id)?.nombre || '—';
const polizaLabel = p => p ? `${p.ramo} · ${p.compania} · N° ${p.numero}` : '—';
const urlPortal = () => location.href.replace(/admin\.html.*$/, 'login.html');
const linkCliente = id => `<a href="#cliente/${id}">${esc(nombreCliente(id))}</a>`;

function deudaVencida(clienteId) {
  return DB.where('pagos', p => p.clienteId === clienteId && estadoPago(p) === 'vencido').reduce((s, p) => s + +p.monto, 0);
}

function actualizarContadores() {
  const set = (id, n) => { const el = $('#c-' + id); el.textContent = n; el.classList.toggle('hidden', !n); };
  set('pagos', DB.where('pagos', p => estadoPago(p) === 'informado').length);
  set('presupuestos', DB.where('presupuestos', p => p.estado === 'nuevo' || p.estado === 'aceptado').length);
  set('siniestros', DB.where('siniestros', s => s.estado === 'denunciado').length);
}

function render(html) {
  view().innerHTML = html;
  actualizarContadores();
}

// ---------- Vistas ----------

const vistas = {
  inicio() {
    const pols = DB.all('polizas');
    const pagos = DB.all('pagos');
    const vencidos = pagos.filter(p => estadoPago(p) === 'vencido');
    const informados = pagos.filter(p => estadoPago(p) === 'informado');
    const porVencer = pols.filter(p => estadoPoliza(p) === 'por vencer').sort((a, b) => a.vigenciaHasta.localeCompare(b.vigenciaHasta));
    const presNuevos = DB.where('presupuestos', p => p.estado === 'nuevo' || p.estado === 'aceptado');
    const sinAbiertos = DB.where('siniestros', s => s.estado === 'denunciado' || s.estado === 'en trámite');
    render(`
      <div class="page-head"><h1>Hola, ${esc(yo.nombre)} 👋</h1>
        <div class="actions"><button class="btn" data-act="nuevoCliente">+ Nuevo cliente</button><button class="btn ghost" data-act="nuevaPoliza">+ Nueva póliza</button></div></div>
      <div class="stats">
        <a class="stat" href="#clientes"><div class="n">${clientes().length}</div><div class="l">Clientes</div></a>
        <a class="stat" href="#polizas"><div class="n">${pols.filter(p => ['vigente', 'por vencer'].includes(estadoPoliza(p))).length}</div><div class="l">Pólizas vigentes</div></a>
        <a class="stat ${vencidos.length ? 'alert' : ''}" href="#pagos/vencido"><div class="n">${vencidos.length}</div><div class="l">Cuotas vencidas · ${money(vencidos.reduce((s, p) => s + +p.monto, 0))}</div></a>
        <a class="stat ${informados.length ? 'alert' : ''}" href="#pagos/informado"><div class="n">${informados.length}</div><div class="l">Pagos a confirmar</div></a>
        <a class="stat ${presNuevos.length ? 'alert' : ''}" href="#presupuestos"><div class="n">${presNuevos.length}</div><div class="l">Presupuestos sin responder</div></a>
        <a class="stat ${sinAbiertos.length ? 'alert' : ''}" href="#siniestros"><div class="n">${sinAbiertos.length}</div><div class="l">Siniestros abiertos</div></a>
      </div>
      <div class="grid two">
        <div class="card"><h2>Pólizas por vencer (30 días)</h2>
          ${tabla(['Cliente', 'Póliza', 'Vence', ''], porVencer.map(p => [linkCliente(p.clienteId), esc(polizaLabel(p)), fdate(p.vigenciaHasta),
            waBoton(p.clienteId, `Hola! Te recuerdo que tu póliza de ${p.ramo} (${p.compania}) vence el ${fdate(p.vigenciaHasta)}. ¿La renovamos?`)]),
            'No hay pólizas por vencer en los próximos 30 días.')}</div>
        <div class="card"><h2>Cuotas vencidas</h2>
          ${tabla(['Cliente', 'Cuota', 'Venció', 'Monto', ''], vencidos.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento)).map(p => [
            linkCliente(p.clienteId), esc(p.periodo), fdate(p.vencimiento), money(p.monto),
            waBoton(p.clienteId, `Hola! Te recuerdo que la ${p.periodo} de tu seguro (${money(p.monto)}) venció el ${fdate(p.vencimiento)}.`)]),
            'No hay cuotas vencidas. 🎉')}</div>
      </div>
      <div class="card"><div class="card-head"><h2>Presupuestos pendientes</h2><a href="#presupuestos">Ver todos</a></div>
        ${tabla(['Fecha', 'Nombre', 'Ramo', 'Estado', ''], presNuevos.map(p => [fdate(p.creado), esc(p.clienteId ? nombreCliente(p.clienteId) : p.nombre),
          esc(p.ramo), badge(p.estado), `<button class="btn sm" data-act="responderPresupuesto" data-id="${p.id}">Ver</button>`]), 'No hay presupuestos pendientes.')}</div>`);
  },

  clientes() {
    render(`
      <div class="page-head"><h1>Clientes</h1>
        <div class="actions"><a class="btn ghost" href="#importar">📥 Importar Excel</a><button class="btn" data-act="nuevoCliente">+ Nuevo cliente</button></div></div>
      <div class="card">
        <div class="toolbar"><input type="search" id="buscar" placeholder="Buscar por nombre, DNI, email o teléfono…"></div>
        <div id="lista"></div>
      </div>`);
    const pintar = () => {
      const q = $('#buscar').value.trim().toLowerCase();
      const lista = clientes().filter(c => [c.nombre, c.dni, c.email, c.telefono].join(' ').toLowerCase().includes(q));
      $('#lista').innerHTML = tabla(['Nombre', 'DNI', 'Teléfono', 'Usuario', 'Pólizas', 'Deuda vencida', 'Acceso'],
        lista.map(c => {
          const deuda = deudaVencida(c.id);
          return [`<a href="#cliente/${c.id}"><strong>${esc(c.nombre)}</strong></a>`, esc(c.dni || '-'), esc(c.telefono || '-'), esc(usuarioVisible(c)),
            DB.where('polizas', p => p.clienteId === c.id).length, deuda ? `<span class="badge red">${money(deuda)}</span>` : '-',
            c.bloqueado ? badge('deshabilitado') : badge('activo')];
        }), q ? 'No se encontraron clientes.' : 'Todavía no cargaste clientes.');
    };
    $('#buscar').addEventListener('input', pintar);
    pintar();
  },

  cliente(id) {
    const c = DB.get('users', id);
    if (!c || c.role !== 'cliente') return (location.hash = '#clientes');
    const pols = DB.where('polizas', p => p.clienteId === id);
    const pagos = DB.where('pagos', p => p.clienteId === id).sort((a, b) => b.vencimiento.localeCompare(a.vencimiento));
    const pres = DB.where('presupuestos', p => p.clienteId === id);
    const sins = DB.where('siniestros', s => s.clienteId === id);
    render(`
      <div class="page-head"><h1>${esc(c.nombre)}</h1>
        <div class="actions">
          ${waBoton(id, `Hola ${c.nombre}!`, 'WhatsApp')}
          <button class="btn ghost" data-act="enviarAcceso" data-id="${id}">🔑 Enviar acceso</button>
          <button class="btn ghost" data-act="editarCliente" data-id="${id}">Editar</button>
          <button class="btn ghost" data-act="toggleAcceso" data-id="${id}">${c.bloqueado ? 'Habilitar acceso' : 'Deshabilitar acceso'}</button>
          <button class="btn danger" data-act="eliminarCliente" data-id="${id}">Eliminar</button>
        </div></div>
      <div class="card"><dl class="dl">
        <dt>DNI / CUIT</dt><dd>${esc(c.dni || '-')}</dd>
        <dt>Usuario para ingresar</dt><dd>${esc(usuarioVisible(c))}</dd>
        <dt>Teléfono</dt><dd>${esc(c.telefono || '-')}</dd>
        <dt>Dirección</dt><dd>${esc(c.direccion || '-')}</dd>
        <dt>Fecha de nacimiento</dt><dd>${fdate(c.nacimiento)}</dd>
        <dt>Acceso al portal</dt><dd>${c.bloqueado ? badge('deshabilitado') : badge('activo')}</dd>
        <dt>Notas internas</dt><dd style="white-space:pre-wrap">${esc(c.notas || '-')}</dd>
      </dl></div>
      <div class="card"><div class="card-head"><h2>Pólizas</h2><button class="btn sm" data-act="nuevaPoliza" data-cliente="${id}">+ Nueva póliza</button></div>
        ${tablaPolizas(pols, false)}</div>
      <div class="card"><div class="card-head"><h2>Pagos</h2><button class="btn sm" data-act="nuevoPago" data-cliente="${id}">+ Registrar cuota</button></div>
        ${tablaPagos(pagos, false)}</div>
      <div class="grid two">
        <div class="card"><h2>Presupuestos</h2>${tabla(['Fecha', 'Ramo', 'Estado', ''], pres.map(p => [fdate(p.creado), esc(p.ramo), badge(p.estado),
          `<button class="btn sm ghost" data-act="responderPresupuesto" data-id="${p.id}">Ver</button>`]), 'Sin presupuestos.')}</div>
        <div class="card"><h2>Siniestros</h2>${tabla(['Fecha', 'Tipo', 'Estado', ''], sins.map(s => [fdate(s.fecha), esc(s.tipo), badge(s.estado),
          `<button class="btn sm ghost" data-act="verSiniestro" data-id="${s.id}">Ver</button>`]), 'Sin siniestros.')}</div>
      </div>`);
  },

  polizas() {
    render(`
      <div class="page-head"><h1>Pólizas</h1>
        <div class="actions"><a class="btn ghost" href="#pdfs">📎 Cargar PDFs</a><button class="btn" data-act="nuevaPoliza">+ Nueva póliza</button></div></div>
      <div class="card">
        <div class="toolbar">
          <input type="search" id="buscar" placeholder="Buscar cliente, número, bien…">
          <select id="f-estado"><option value="">Todos los estados</option><option>vigente</option><option>por vencer</option><option>vencida</option><option>anulada</option></select>
          <select id="f-ramo"><option value="">Todos los ramos</option>${CONFIG.ramos.map(r => `<option>${esc(r)}</option>`).join('')}</select>
        </div>
        <div id="lista"></div>
      </div>`);
    const pintar = () => {
      const q = $('#buscar').value.trim().toLowerCase(), est = $('#f-estado').value, ramo = $('#f-ramo').value;
      const lista = DB.all('polizas')
        .filter(p => (!est || estadoPoliza(p) === est) && (!ramo || p.ramo === ramo))
        .filter(p => [nombreCliente(p.clienteId), p.numero, p.bien, p.compania].join(' ').toLowerCase().includes(q))
        .sort((a, b) => a.vigenciaHasta.localeCompare(b.vigenciaHasta));
      $('#lista').innerHTML = tablaPolizas(lista, true);
    };
    $$('#buscar, #f-estado, #f-ramo').forEach(el => el.addEventListener('input', pintar));
    pintar();
  },

  pagos(filtro = '') {
    render(`
      <div class="page-head"><h1>Pagos y cuotas</h1><button class="btn" data-act="nuevoPago">+ Registrar cuota</button></div>
      <div class="card">
        <div class="toolbar">
          <input type="search" id="buscar" placeholder="Buscar cliente…">
          <select id="f-estado">${[['', 'Todos'], ['vencido', 'Vencidos'], ['pendiente', 'Pendientes'], ['informado', 'Informados (a confirmar)'], ['pagado', 'Pagados']]
            .map(([v, t]) => `<option value="${v}" ${v === filtro ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </div>
        <div id="lista"></div>
      </div>`);
    const pintar = () => {
      const q = $('#buscar').value.trim().toLowerCase(), est = $('#f-estado').value;
      const lista = DB.all('pagos')
        .filter(p => (!est || estadoPago(p) === est) && nombreCliente(p.clienteId).toLowerCase().includes(q))
        .sort((a, b) => b.vencimiento.localeCompare(a.vencimiento));
      const total = lista.reduce((s, p) => s + +p.monto, 0);
      $('#lista').innerHTML = `<p class="muted">${lista.length} cuotas · Total ${money(total)}</p>` + tablaPagos(lista, true);
    };
    $$('#buscar, #f-estado').forEach(el => el.addEventListener('input', pintar));
    pintar();
  },

  presupuestos() {
    const lista = DB.all('presupuestos').sort((a, b) => b.creado.localeCompare(a.creado));
    render(`
      <div class="page-head"><h1>Presupuestos</h1></div>
      <div class="notice info">Acá llegan las solicitudes del formulario de la web y las que piden tus clientes desde el portal. Cuando un cliente acepta una propuesta, aparece como <strong>aceptado</strong>.</div>
      <div class="card">${tabla(['Fecha', 'Solicitante', 'Contacto', 'Ramo', 'Estado', ''], lista.map(p => [
        fdate(p.creado),
        p.clienteId ? linkCliente(p.clienteId) + ' <span class="badge blue">cliente</span>' : esc(p.nombre),
        esc(p.clienteId ? DB.get('users', p.clienteId)?.telefono : p.telefono) + '<br><small class="muted">' + esc(p.clienteId ? usuarioVisible(DB.get('users', p.clienteId)) : p.email) + '</small>',
        esc(p.ramo), badge(p.estado),
        `<div class="actions"><button class="btn sm" data-act="responderPresupuesto" data-id="${p.id}">Ver / responder</button>
          <button class="btn sm ghost" data-act="eliminarPresupuesto" data-id="${p.id}">Eliminar</button></div>`]),
        'Todavía no hay solicitudes de presupuesto.')}</div>`);
  },

  siniestros() {
    const lista = DB.all('siniestros').sort((a, b) => b.creado.localeCompare(a.creado));
    render(`
      <div class="page-head"><h1>Siniestros</h1></div>
      <div class="card">${tabla(['Fecha', 'Cliente', 'Póliza', 'Tipo', 'Estado', ''], lista.map(s => [
        fdate(s.fecha), linkCliente(s.clienteId), esc(polizaLabel(DB.get('polizas', s.polizaId))), esc(s.tipo), badge(s.estado),
        `<button class="btn sm" data-act="verSiniestro" data-id="${s.id}">Ver / actualizar</button>`]),
        'No hay siniestros denunciados.')}</div>`);
  },

  ajustes() {
    render(`
      <div class="page-head"><h1>Ajustes</h1></div>
      <div class="grid two">
        <div class="card"><h2>Mi cuenta</h2>
          <form id="f-cuenta" class="form-grid">
            ${campo('Nombre', 'nombre', { value: yo.nombre, required: true, full: true })}
            ${campo('Email de ingreso', 'email', { type: 'email', value: yo.email, required: true, full: true })}
            ${campo('Contraseña actual', 'actual', { type: 'password', required: true })}
            ${campo('Nueva contraseña', 'nueva', { type: 'password', hint: 'Dejala vacía para no cambiarla' })}
            <div class="full"><button class="btn" type="submit">Guardar cambios</button></div>
          </form></div>
        <div class="card"><h2>Copia de seguridad</h2>
          <p class="muted">Los datos se guardan en la nube (Supabase). Igual podés descargar cuando quieras una copia de clientes, pólizas, pagos, presupuestos y siniestros.</p>
          <div class="actions"><button class="btn" data-act="exportar">Descargar copia</button></div>
          <h2 style="margin-top:24px">Datos del sitio</h2>
          <p class="muted">El nombre, matrícula, teléfono, WhatsApp y compañías se configuran en el archivo <code>js/config.js</code>.</p>
        </div>
      </div>`);
    $('#f-cuenta').addEventListener('submit', async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      try {
        if (!await Auth.checkPassword(d.actual)) throw new Error('La contraseña actual no es correcta');
        await DB.update('users', yo.id, { nombre: d.nombre });
        if (d.nueva) await Auth.setPassword(d.nueva);
        const cambioEmail = d.email.trim().toLowerCase() !== yo.email;
        if (cambioEmail) await Auth.cambiarEmail(d.email);
        $('#user-name').textContent = d.nombre;
        toast(cambioEmail ? 'Datos guardados. Confirmá el cambio de email desde el link que te llegó.' : 'Datos actualizados');
        e.target.actual.value = e.target.nueva.value = '';
      } catch (err) { toast(err.message, 'error'); }
    });
  },
};

// ---------- Tablas reutilizables ----------

function tablaPolizas(lista, conCliente) {
  const cols = [...(conCliente ? ['Cliente'] : []), 'Ramo', 'Compañía', 'N° póliza', 'Bien asegurado', 'Vigencia', 'Cuota', 'Estado', ''];
  return tabla(cols, lista.map(p => [
    ...(conCliente ? [linkCliente(p.clienteId)] : []),
    esc(p.ramo), esc(p.compania), esc(p.numero), esc(p.bien), `${fdate(p.vigenciaDesde)} – ${fdate(p.vigenciaHasta)}`, money(p.prima), badge(estadoPoliza(p)),
    `<div class="actions">
      ${p.archivo ? `<button class="btn sm ghost" data-act="verPoliza" data-id="${p.id}" title="Ver póliza">📎 PDF</button>` : ''}
      <button class="btn sm ghost" data-act="certificado" data-id="${p.id}" title="Certificado de cobertura">📄</button>
      <button class="btn sm ghost" data-act="editarPoliza" data-id="${p.id}">Editar</button>
      <button class="btn sm ghost" data-act="renovarPoliza" data-id="${p.id}">Renovar</button>
      <button class="btn sm ghost" data-act="eliminarPoliza" data-id="${p.id}" title="Eliminar">🗑</button>
    </div>`]), 'No hay pólizas cargadas.');
}

function tablaPagos(lista, conCliente) {
  const cols = [...(conCliente ? ['Cliente'] : []), 'Póliza', 'Cuota', 'Vencimiento', 'Monto', 'Estado', 'Pago', ''];
  return tabla(cols, lista.map(p => {
    const est = estadoPago(p);
    const pol = DB.get('polizas', p.polizaId);
    return [
      ...(conCliente ? [linkCliente(p.clienteId)] : []),
      esc(pol ? `${pol.ramo} · ${pol.numero}` : '—'), esc(p.periodo), fdate(p.vencimiento), money(p.monto), badge(est),
      p.fechaPago ? `${fdate(p.fechaPago)}<br><small class="muted">${esc(p.medio || '')}</small>` : '-',
      `<div class="actions">
        ${p.comprobante ? `<button class="btn sm ghost" data-act="verComprobante" data-id="${p.id}">🧾 Comprobante</button>` : ''}
        ${est !== 'pagado' ? `<button class="btn sm success" data-act="marcarPagado" data-id="${p.id}">${est === 'informado' ? 'Confirmar' : 'Marcar pagado'}</button>` : ''}
        ${est === 'informado' ? `<button class="btn sm ghost" data-act="rechazarPago" data-id="${p.id}">Rechazar</button>` : ''}
        ${est === 'pagado' ? `<button class="btn sm ghost" data-act="desmarcarPago" data-id="${p.id}">Anular pago</button>` : ''}
        <button class="btn sm ghost" data-act="editarPago" data-id="${p.id}">Editar</button>
        <button class="btn sm ghost" data-act="eliminarPago" data-id="${p.id}" title="Eliminar">🗑</button>
      </div>`];
  }), 'No hay cuotas registradas.');
}

function waBoton(clienteId, texto, label = '💬') {
  const url = linkWhatsapp(DB.get('users', clienteId)?.telefono, texto);
  return url ? `<a class="btn sm wa" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` : '';
}

// ---------- Formularios ----------

function formCliente(c = {}, nuevo = false) {
  return `<div class="form-grid">
    ${campo('Nombre y apellido / Razón social', 'nombre', { value: c.nombre, required: true, full: true })}
    ${campo('DNI / CUIT', 'dni', { value: c.dni })}
    ${campo('Fecha de nacimiento', 'nacimiento', { type: 'date', value: c.nacimiento })}
    ${nuevo ? campo('Email', 'email', { type: 'email', value: c.email, hint: 'Si no tiene email, va a ingresar con su DNI' })
      : campo('Usuario para ingresar', 'usuario', { value: usuarioVisible(c), attrs: 'disabled' })}
    ${campo('Teléfono / WhatsApp', 'telefono', { type: 'tel', value: c.telefono, hint: 'Con código de área, ej: 11 5555-1234' })}
    ${campo('Dirección', 'direccion', { value: c.direccion, full: true })}
    ${nuevo ? campo('Contraseña inicial', 'password', { value: Math.random().toString(36).slice(2, 10), required: true, full: true, hint: 'Pasásela al cliente. Después la puede cambiar desde su portal.' }) : ''}
    ${campo('Notas internas (el cliente no las ve)', 'notas', { type: 'textarea', value: c.notas, full: true })}
  </div>`;
}

function datosCliente(d) {
  return { nombre: d.nombre.trim(), dni: d.dni, nacimiento: d.nacimiento || null, telefono: d.telefono, direccion: d.direccion, notas: d.notas };
}

function formPoliza(p = {}, clienteId = '') {
  const nueva = !p.id;
  const desde = p.vigenciaDesde || hoyISO();
  return `<div class="form-grid">
    ${campo('Cliente', 'clienteId', { value: p.clienteId || clienteId, required: true, full: true,
      options: [['', 'Elegí un cliente…'], ...clientes().map(c => [c.id, `${c.nombre}${c.dni ? ' - ' + c.dni : ''}`])] })}
    ${campo('Ramo', 'ramo', { value: p.ramo, options: CONFIG.ramos })}
    ${campo('Compañía', 'compania', { value: p.compania, required: true, attrs: 'list="dl-companias"' })}
    <datalist id="dl-companias">${CONFIG.companias.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    ${campo('N° de póliza', 'numero', { value: p.numero, required: true })}
    ${campo('Estado', 'estado', { value: p.estado || 'activa', options: [['activa', 'Activa'], ['anulada', 'Anulada']] })}
    ${campo('Bien asegurado', 'bien', { value: p.bien, required: true, full: true, attrs: 'placeholder="Ej: Ford Fiesta 2018 - AB123CD / Casa en Av. X 123"' })}
    ${campo('Cobertura', 'cobertura', { value: p.cobertura, full: true, attrs: 'placeholder="Ej: Terceros completo"' })}
    ${campo('Vigencia desde', 'vigenciaDesde', { type: 'date', value: desde, required: true })}
    ${campo('Vigencia hasta', 'vigenciaHasta', { type: 'date', value: p.vigenciaHasta || sumarMeses(desde, 12), required: true })}
    ${campo('Cuota mensual ($)', 'prima', { type: 'number', value: p.prima, required: true, attrs: 'min="0" step="0.01"' })}
    ${campo('Suma asegurada ($)', 'suma', { type: 'number', value: p.suma, attrs: 'min="0" step="0.01"' })}
    ${campo(p.archivo ? `Reemplazar PDF de la póliza (actual: ${p.archivo.nombre})` : 'PDF de la póliza', 'archivo', { type: 'file', full: true, attrs: 'accept=".pdf,image/*"', hint: 'Máximo 10 MB. El cliente lo podrá ver y descargar desde su portal.' })}
    ${nueva ? campo('Generar cuotas automáticamente', 'cuotas', { type: 'number', value: 12, full: true, attrs: 'min="0" max="24"', hint: 'Se crea una cuota por mes desde el inicio de la vigencia. Poné 0 para no generar.' }) : ''}
  </div>`;
}

async function datosPoliza(d) {
  if (d.vigenciaHasta < d.vigenciaDesde) throw new Error('La vigencia "hasta" no puede ser anterior a "desde"');
  const out = { clienteId: d.clienteId, ramo: d.ramo, compania: d.compania.trim(), numero: d.numero.trim(), estado: d.estado, bien: d.bien.trim(),
    cobertura: d.cobertura, vigenciaDesde: d.vigenciaDesde, vigenciaHasta: d.vigenciaHasta, prima: +d.prima, suma: +d.suma || 0 };
  const archivo = await subirSiHay(d.archivo, d.clienteId);
  if (archivo) out.archivo = archivo;
  return out;
}

function generarCuotas(pol, n) {
  return DB.insertMany('pagos', Array.from({ length: n }, (_, i) => ({ polizaId: pol.id, clienteId: pol.clienteId,
    periodo: `Cuota ${i + 1}/${n}`, monto: pol.prima, vencimiento: sumarMeses(pol.vigenciaDesde, i), estado: 'pendiente' })));
}

function formPago(p = {}, clienteId = '') {
  const pols = DB.all('polizas').filter(x => !clienteId || x.clienteId === clienteId);
  return `<div class="form-grid">
    ${campo('Póliza', 'polizaId', { value: p.polizaId, required: true, full: true,
      options: [['', 'Elegí una póliza…'], ...pols.map(x => [x.id, `${nombreCliente(x.clienteId)} — ${polizaLabel(x)}`])] })}
    ${campo('Concepto', 'periodo', { value: p.periodo || 'Cuota', required: true })}
    ${campo('Monto ($)', 'monto', { type: 'number', value: p.monto, required: true, attrs: 'min="0" step="0.01"' })}
    ${campo('Vencimiento', 'vencimiento', { type: 'date', value: p.vencimiento || hoyISO(), required: true })}
  </div>`;
}

// ---------- Acciones ----------

const acciones = {
  async nuevoCliente() {
    modal('Nuevo cliente', formCliente({}, true), async d => {
      const { notas, ...datos } = datosCliente(d);
      const id = await Auth.crearCliente({ ...datos, email: d.email }, d.password);
      if (notas) await DB.update('users', id, { notas });
      toast('Cliente creado');
      location.hash = '#cliente/' + id;
      await refrescar();
      mostrarAcceso(DB.get('users', id), d.password);
    });
  },

  async editarCliente(id) {
    const c = DB.get('users', id);
    modal('Editar cliente', formCliente(c), async d => {
      await DB.update('users', id, datosCliente(d));
      toast('Cliente actualizado');
      await refrescar();
    });
  },

  // Las contraseñas no se pueden ver: para mandarle el acceso se genera una nueva
  async enviarAcceso(id) {
    const c = DB.get('users', id);
    if (!confirmar(`Se va a generar una contraseña nueva para ${c.nombre} (si tenía una, deja de funcionar). ¿Continuar?`)) return;
    const password = contrasenaAleatoria();
    await Auth.cambiarPasswordDe(id, password);
    mostrarAcceso(c, password);
  },

  async toggleAcceso(id) {
    const c = DB.get('users', id);
    await DB.update('users', id, { bloqueado: !c.bloqueado });
    toast(c.bloqueado ? 'Acceso deshabilitado' : 'Acceso habilitado');
    await refrescar();
  },

  async eliminarCliente(id) {
    if (!confirmar('¿Eliminar este cliente y TODAS sus pólizas, pagos, presupuestos y siniestros? No se puede deshacer.\n\nSi solo querés que no entre más al portal, usá “Deshabilitar acceso”.')) return;
    await DB.remove('users', id);
    toast('Cliente eliminado');
    location.hash = '#clientes';
  },

  async nuevaPoliza(_, el) {
    if (!clientes().length) return toast('Primero cargá un cliente', 'error');
    modal('Nueva póliza', formPoliza({}, el.dataset.cliente), async d => {
      const pol = await DB.insert('polizas', { archivo: null, ...await datosPoliza(d) });
      await generarCuotas(pol, Math.min(24, Math.max(0, parseInt(d.cuotas) || 0)));
      toast('Póliza creada');
      await refrescar();
    });
  },

  async editarPoliza(id) {
    modal('Editar póliza', formPoliza(DB.get('polizas', id)), async d => {
      const datos = await datosPoliza(d);
      await DB.update('polizas', id, datos);
      await DB.updateWhere('pagos', 'polizaId', id, { clienteId: datos.clienteId });
      toast('Póliza actualizada');
      await refrescar();
    });
  },

  async renovarPoliza(id) {
    const p = DB.get('polizas', id);
    const desde = p.vigenciaHasta;
    modal('Renovar póliza', formPoliza({ ...p, id: undefined, archivo: null, vigenciaDesde: desde, vigenciaHasta: sumarMeses(desde, 12) }), async d => {
      const pol = await DB.insert('polizas', { archivo: null, ...await datosPoliza(d) });
      await generarCuotas(pol, Math.min(24, Math.max(0, parseInt(d.cuotas) || 0)));
      toast('Renovación creada');
      await refrescar();
    }, 'Crear renovación');
  },

  async eliminarPoliza(id) {
    if (!confirmar('¿Eliminar esta póliza y sus cuotas?')) return;
    await DB.remove('polizas', id);
    toast('Póliza eliminada');
    await refrescar();
  },

  verPoliza(id) { return verArchivo(DB.get('polizas', id).archivo); },
  descargarPoliza(id) { return descargar(DB.get('polizas', id).archivo); },
  certificado(id) { const p = DB.get('polizas', id); imprimirCertificado(p, DB.get('users', p.clienteId)); },

  async nuevoPago(_, el) {
    modal('Registrar cuota', formPago({}, el.dataset.cliente), async d => {
      const pol = DB.get('polizas', d.polizaId);
      await DB.insert('pagos', { ...d, monto: +d.monto, clienteId: pol.clienteId, estado: 'pendiente' });
      toast('Cuota registrada');
      await refrescar();
    });
  },

  async editarPago(id) {
    modal('Editar cuota', formPago(DB.get('pagos', id)), async d => {
      await DB.update('pagos', id, { ...d, monto: +d.monto, clienteId: DB.get('polizas', d.polizaId).clienteId });
      toast('Cuota actualizada');
      await refrescar();
    });
  },

  async marcarPagado(id) {
    const p = DB.get('pagos', id);
    modal(`Registrar pago · ${p.periodo} · ${money(p.monto)}`, `<div class="form-grid">
      ${campo('Fecha de pago', 'fechaPago', { type: 'date', value: p.fechaPago || hoyISO(), required: true })}
      ${campo('Medio de pago', 'medio', { value: p.medio, options: MEDIOS })}
      ${p.nota ? `<p class="full muted">Nota del cliente: ${esc(p.nota)}</p>` : ''}</div>`, async d => {
      await DB.update('pagos', id, { estado: 'pagado', fechaPago: d.fechaPago, medio: d.medio });
      toast('Pago registrado');
      await refrescar();
    }, 'Confirmar pago');
  },

  async rechazarPago(id) {
    if (!confirmar('¿Rechazar el pago informado? La cuota vuelve a quedar pendiente.')) return;
    await DB.update('pagos', id, { estado: 'pendiente', fechaPago: null, medio: null });
    await refrescar();
  },

  async desmarcarPago(id) {
    if (!confirmar('¿Anular el pago de esta cuota?')) return;
    await DB.update('pagos', id, { estado: 'pendiente', fechaPago: null, medio: null });
    await refrescar();
  },

  async eliminarPago(id) {
    if (!confirmar('¿Eliminar esta cuota?')) return;
    await DB.remove('pagos', id);
    await refrescar();
  },

  verComprobante(id) { return descargar(DB.get('pagos', id).comprobante); },

  async responderPresupuesto(id) {
    const p = DB.get('presupuestos', id);
    const cli = p.clienteId ? DB.get('users', p.clienteId) : null;
    const tel = cli ? cli.telefono : p.telefono;
    const wa = linkWhatsapp(tel, `Hola ${cli ? cli.nombre : p.nombre}! Te escribo por el presupuesto de seguro de ${p.ramo} que pediste.`);
    modal('Presupuesto de ' + (cli ? cli.nombre : p.nombre), `
      <dl class="dl">
        <dt>Fecha</dt><dd>${fdate(p.creado)}</dd>
        <dt>Contacto</dt><dd>${esc(tel || '-')} · ${esc(cli ? usuarioVisible(cli) : p.email)} ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</dd>
        <dt>Ramo</dt><dd>${esc(p.ramo)}</dd>
        <dt>Detalle</dt><dd style="white-space:pre-wrap">${esc(p.detalle)}</dd>
        <dt>Estado</dt><dd>${badge(p.estado)}</dd>
      </dl>
      ${!cli ? '<div class="notice" style="margin-top:14px">Esta persona no es cliente: respondele por teléfono, WhatsApp o email. Si querés, creale un usuario desde Clientes.</div>' : ''}
      <h3 style="margin-top:18px">Propuesta</h3>
      <div class="form-grid">
        ${campo('Compañía', 'compania', { value: p.compania, attrs: 'list="dl-companias"' })}
        <datalist id="dl-companias">${CONFIG.companias.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        ${campo('Cuota mensual ($)', 'monto', { type: 'number', value: p.monto, attrs: 'min="0" step="0.01"' })}
        ${campo('Respuesta / condiciones', 'respuesta', { type: 'textarea', value: p.respuesta, full: true })}
        ${campo(p.archivo ? `Reemplazar adjunto (actual: ${p.archivo.nombre})` : 'Adjuntar cotización (PDF)', 'archivo', { type: 'file', full: true, attrs: 'accept=".pdf,image/*"' })}
        ${campo('Estado', 'estado', { value: p.estado === 'nuevo' ? 'respondido' : p.estado,
          options: [['nuevo', 'Nuevo'], ['respondido', 'Respondido'], ['aceptado', 'Aceptado por el cliente'], ['rechazado', 'Rechazado'], ['cerrado', 'Cerrado']] })}
      </div>`, async d => {
      const patch = { compania: d.compania, monto: +d.monto || null, respuesta: d.respuesta, estado: d.estado, respondido: new Date().toISOString() };
      const archivo = await subirSiHay(d.archivo, p.clienteId);
      if (archivo) patch.archivo = archivo;
      await DB.update('presupuestos', id, patch);
      toast('Presupuesto guardado');
      await refrescar();
    });
  },

  async eliminarPresupuesto(id) {
    if (!confirmar('¿Eliminar esta solicitud?')) return;
    await DB.remove('presupuestos', id);
    await refrescar();
  },

  async verSiniestro(id) {
    const s = DB.get('siniestros', id);
    modal('Siniestro de ' + nombreCliente(s.clienteId), `
      <dl class="dl">
        <dt>Póliza</dt><dd>${esc(polizaLabel(DB.get('polizas', s.polizaId)))}</dd>
        <dt>Fecha del hecho</dt><dd>${fdate(s.fecha)}</dd>
        <dt>Tipo</dt><dd>${esc(s.tipo)}</dd>
        <dt>Lugar</dt><dd>${esc(s.lugar || '-')}</dd>
        <dt>Descripción</dt><dd style="white-space:pre-wrap">${esc(s.descripcion)}</dd>
        <dt>Adjunto</dt><dd>${s.archivo ? `<button type="button" class="btn sm ghost" id="dl-sin">📎 ${esc(s.archivo.nombre)}</button>` : '-'}</dd>
      </dl>
      <h3 style="margin-top:18px">Seguimiento</h3>
      ${(s.notas || []).map(n => `<div class="reply"><small class="muted">${fdate(n.fecha)} · ${badge(n.estado)}</small><br>${esc(n.texto)}</div>`).join('') || '<p class="muted">Sin novedades todavía.</p>'}
      <div class="form-grid" style="margin-top:14px">
        ${campo('Estado', 'estado', { value: s.estado, options: ESTADOS_SINIESTRO })}
        ${campo('N° de siniestro en la compañía', 'numero', { value: s.numero })}
        ${campo('Novedad para el cliente', 'texto', { type: 'textarea', full: true, hint: 'El cliente la ve en su portal' })}
      </div>`, async d => {
      const notas = [...(s.notas || [])];
      if (d.texto.trim() || d.estado !== s.estado) notas.push({ fecha: new Date().toISOString(), estado: d.estado, texto: d.texto.trim() || 'Cambio de estado' });
      await DB.update('siniestros', id, { estado: d.estado, numero: d.numero, notas });
      toast('Siniestro actualizado');
      await refrescar();
    });
    const btn = $('#dl-sin');
    if (btn) btn.onclick = () => descargar(s.archivo).catch(err => toast(err.message, 'error'));
  },

  async exportar() {
    const blob = new Blob([DB.exportar()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `copia-seguros-${hoyISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

function mensajeAcceso(c, password) {
  return `Hola ${c.nombre}! Ya tenés acceso al portal de clientes de ${CONFIG.marca}, donde podés ver tus pólizas, controlar tus pagos y pedir presupuestos.\n\nIngresá en: ${urlPortal()}\nUsuario: ${entraConDni(c) ? c.email.replace(DOMINIO_DNI, '') : c.email}\nContraseña: ${password}\n\nDespués podés cambiar la contraseña desde "Mis datos".`;
}

function mostrarAcceso(c, password) {
  const texto = mensajeAcceso(c, password);
  const wa = linkWhatsapp(c.telefono, texto);
  modal('Datos de acceso', `
    <p>Enviale estos datos al cliente para que pueda ingresar a su portal:</p>
    <div class="reply" id="txt-acceso">${esc(texto)}</div>
    <div class="actions" style="margin-top:14px">
      ${wa ? `<a class="btn wa" href="${esc(wa)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>` : ''}
      ${entraConDni(c) ? '' : `<a class="btn ghost" href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Acceso al portal de clientes')}&body=${encodeURIComponent(texto)}">Enviar por email</a>`}
      <button type="button" class="btn ghost" id="copiar">Copiar</button>
    </div>`);
  $('#copiar').onclick = () => navigator.clipboard.writeText(texto).then(() => toast('Copiado'));
}

// ---------- Inicio ----------

(async () => {
  if (!CONFIGURADO) return pantallaSinConfigurar();
  yo = await Auth.require('admin');
  $$('[data-cfg]').forEach(el => { el.textContent = CONFIG[el.dataset.cfg]; });
  $('#user-name').textContent = yo.nombre;
  document.title = 'Panel · ' + CONFIG.marca;
  conectarAcciones(acciones);
  refrescar = iniciarRouter(vistas, 'inicio', async () => {
    await DB.cargar();
    yo = DB.get('users', yo.id) || yo;
  });
})();
