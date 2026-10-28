// Portal del cliente

let yo, refrescar;
const view = () => $('#view');
const TIPOS_SINIESTRO = ['Choque / accidente', 'Robo total', 'Robo parcial', 'Granizo', 'Rotura de cristales', 'Incendio', 'Daños por agua', 'Robo en domicilio', 'Otro'];
const MEDIOS = ['Transferencia', 'Efectivo', 'Tarjeta de crédito', 'Mercado Pago', 'Pago Fácil / Rapipago', 'Otro'];

const misPolizas = () => DB.where('polizas', p => p.clienteId === yo.id).sort((a, b) => b.vigenciaHasta.localeCompare(a.vigenciaHasta));
const misPagos = () => DB.where('pagos', p => p.clienteId === yo.id).sort((a, b) => b.vencimiento.localeCompare(a.vencimiento));
const miPoliza = id => { const p = DB.get('polizas', id); return p && p.clienteId === yo.id ? p : null; };
const polizaLabel = p => p ? `${p.ramo} · ${p.compania} · N° ${p.numero}` : '—';
const waProductor = (texto = '') => linkWhatsapp(CONFIG.whatsapp, texto);

const vistas = {
  inicio() {
    const pols = misPolizas().filter(p => ['vigente', 'por vencer'].includes(estadoPoliza(p)));
    const pagos = misPagos();
    const vencidos = pagos.filter(p => estadoPago(p) === 'vencido');
    const proximo = pagos.filter(p => estadoPago(p) === 'pendiente').sort((a, b) => a.vencimiento.localeCompare(b.vencimiento))[0];
    const porVencer = pols.filter(p => estadoPoliza(p) === 'por vencer');
    const respondidos = DB.where('presupuestos', p => p.clienteId === yo.id && p.estado === 'respondido');
    view().innerHTML = `
      <div class="page-head"><h1>Hola, ${esc(yo.nombre.split(' ')[0])} 👋</h1></div>
      ${vencidos.length ? `<div class="notice">⚠️ Tenés ${vencidos.length} cuota(s) vencida(s) por ${money(vencidos.reduce((s, p) => s + +p.monto, 0))}. <a href="#pagos">Ver pagos</a></div>` : ''}
      ${porVencer.map(p => `<div class="notice">📅 Tu póliza de ${esc(p.ramo)} (${esc(p.bien)}) vence el ${fdate(p.vigenciaHasta)}. <a href="${esc(waProductor(`Hola! Quiero renovar mi póliza de ${p.ramo} N° ${p.numero}.`))}" target="_blank" rel="noopener">Consultar renovación</a></div>`).join('')}
      ${respondidos.length ? `<div class="notice info">📝 Tenés ${respondidos.length} presupuesto(s) respondido(s). <a href="#presupuestos">Ver propuesta</a></div>` : ''}
      <div class="stats">
        <a class="stat" href="#polizas"><div class="n">${pols.length}</div><div class="l">Pólizas vigentes</div></a>
        <a class="stat" href="#pagos"><div class="n">${proximo ? money(proximo.monto) : '-'}</div><div class="l">${proximo ? 'Próxima cuota · vence ' + fdate(proximo.vencimiento) : 'Sin cuotas pendientes'}</div></a>
        <a class="stat ${vencidos.length ? 'alert' : ''}" href="#pagos"><div class="n">${vencidos.length}</div><div class="l">Cuotas vencidas</div></a>
      </div>
      <div class="card"><h2>¿Qué necesitás hacer?</h2>
        <div class="actions">
          <a class="btn" href="#polizas">📄 Descargar mi póliza</a>
          <a class="btn ghost" href="#pagos">💳 Informar un pago</a>
          <button class="btn ghost" data-act="pedirPresupuesto">📝 Pedir presupuesto</button>
          <button class="btn ghost" data-act="denunciarSiniestro">🚨 Denunciar siniestro</button>
          <a class="btn wa" href="${esc(waProductor('Hola! Te escribo desde el portal de clientes.'))}" target="_blank" rel="noopener">💬 Hablar con mi productor</a>
        </div></div>
      <div class="card"><h2>Mis pólizas vigentes</h2>${tarjetasPolizas(pols)}</div>`;
  },

  polizas() {
    view().innerHTML = `
      <div class="page-head"><h1>Mis pólizas</h1></div>
      <p class="muted">Descargá la póliza emitida por la compañía o un certificado de cobertura para imprimir o guardar como PDF.</p>
      ${tarjetasPolizas(misPolizas())}`;
  },

  pagos() {
    const pagos = misPagos();
    view().innerHTML = `
      <div class="page-head"><h1>Mis pagos</h1></div>
      <div class="notice info">💳 <strong>¿Cómo pagar?</strong> ${esc(CONFIG.datosPago)}<br>Después de pagar, tocá <strong>“Informar pago”</strong> y adjuntá el comprobante.</div>
      <div class="card">${tabla(['Póliza', 'Cuota', 'Vencimiento', 'Monto', 'Estado', ''], pagos.map(p => {
        const est = estadoPago(p);
        const pol = DB.get('polizas', p.polizaId);
        return [esc(pol ? `${pol.ramo} · ${pol.compania}` : '—'), esc(p.periodo), fdate(p.vencimiento), money(p.monto),
          badge(est) + (p.fechaPago && est === 'pagado' ? `<br><small class="muted">${fdate(p.fechaPago)}</small>` : ''),
          ['pendiente', 'vencido'].includes(est) ? `<button class="btn sm" data-act="informarPago" data-id="${p.id}">Informar pago</button>`
            : est === 'informado' ? '<small class="muted">Esperando confirmación</small>' : ''];
      }), 'No tenés cuotas registradas.')}</div>`;
  },

  presupuestos() {
    const lista = DB.where('presupuestos', p => p.clienteId === yo.id).sort((a, b) => b.creado.localeCompare(a.creado));
    view().innerHTML = `
      <div class="page-head"><h1>Presupuestos</h1><button class="btn" data-act="pedirPresupuesto">+ Pedir presupuesto</button></div>
      ${lista.length ? lista.map(p => `
        <div class="card">
          <div class="card-head"><h2>Seguro de ${esc(p.ramo)}</h2>${badge(p.estado)}</div>
          <p class="muted" style="margin:0">Pedido el ${fdate(p.creado)}</p>
          <p style="white-space:pre-wrap">${esc(p.detalle)}</p>
          ${p.respuesta || p.monto || p.archivo ? `<div class="reply"><strong>Propuesta de tu productor</strong>
            ${p.compania ? `<br>Compañía: ${esc(p.compania)}` : ''}${p.monto ? `<br>Cuota mensual: <strong>${money(p.monto)}</strong>` : ''}
            ${p.respuesta ? `<br><br>${esc(p.respuesta)}` : ''}</div>` : '<p class="muted">Tu productor está preparando la propuesta.</p>'}
          <div class="actions" style="margin-top:12px">
            ${p.archivo ? `<button class="btn sm ghost" data-act="descargarPresupuesto" data-id="${p.id}">📎 Descargar cotización</button>` : ''}
            ${p.estado === 'respondido' ? `<button class="btn sm success" data-act="aceptarPresupuesto" data-id="${p.id}">Aceptar propuesta</button>
              <button class="btn sm ghost" data-act="rechazarPresupuesto" data-id="${p.id}">No me interesa</button>` : ''}
          </div>
        </div>`).join('') : '<div class="empty">Todavía no pediste presupuestos.</div>'}`;
  },

  siniestros() {
    const lista = DB.where('siniestros', s => s.clienteId === yo.id).sort((a, b) => b.creado.localeCompare(a.creado));
    view().innerHTML = `
      <div class="page-head"><h1>Siniestros</h1><button class="btn" data-act="denunciarSiniestro">+ Denunciar siniestro</button></div>
      <div class="notice">🚨 En caso de emergencia comunicate también con tu productor al ${esc(CONFIG.telefono)}. Recordá que la denuncia a la compañía debe hacerse dentro de las 72 hs del hecho.</div>
      ${lista.length ? lista.map(s => `
        <div class="card">
          <div class="card-head"><h2>${esc(s.tipo)}</h2>${badge(s.estado)}</div>
          <p class="muted" style="margin:0">${fdate(s.fecha)} · ${esc(polizaLabel(DB.get('polizas', s.polizaId)))}${s.numero ? ' · Siniestro N° ' + esc(s.numero) : ''}</p>
          <p style="white-space:pre-wrap">${esc(s.descripcion)}</p>
          ${(s.notas || []).map(n => `<div class="reply"><small class="muted">${fdate(n.fecha)} · ${badge(n.estado)}</small><br>${esc(n.texto)}</div>`).join('')}
        </div>`).join('') : '<div class="empty">No tenés siniestros denunciados.</div>'}`;
  },

  perfil() {
    view().innerHTML = `
      <div class="page-head"><h1>Mis datos</h1></div>
      <div class="grid two">
        <div class="card"><h2>Datos de contacto</h2>
          <form id="f-datos" class="form-grid">
            ${campo('Nombre', 'nombre', { value: yo.nombre, full: true, attrs: 'disabled' })}
            ${campo('DNI / CUIT', 'dni', { value: yo.dni, attrs: 'disabled' })}
            ${campo('Teléfono', 'telefono', { type: 'tel', value: yo.telefono })}
            ${entraConDni(yo) ? campo('Usuario para ingresar', 'usuario', { value: usuarioVisible(yo), full: true, attrs: 'disabled' })
              : campo('Email (usuario)', 'email', { type: 'email', value: yo.email, required: true, full: true })}
            ${campo('Dirección', 'direccion', { value: yo.direccion, full: true })}
            <p class="full muted" style="margin:0;font-size:13px">Para cambiar tu nombre o DNI comunicate con tu productor.</p>
            <div class="full"><button class="btn" type="submit">Guardar</button></div>
          </form></div>
        <div class="card"><h2>Cambiar contraseña</h2>
          <form id="f-pass" class="form-grid">
            ${campo('Contraseña actual', 'actual', { type: 'password', required: true, full: true })}
            ${campo('Nueva contraseña', 'nueva', { type: 'password', required: true, attrs: 'minlength="6"' })}
            ${campo('Repetir nueva', 'repetir', { type: 'password', required: true })}
            <div class="full"><button class="btn" type="submit">Cambiar contraseña</button></div>
          </form></div>
      </div>`;
    $('#f-datos').addEventListener('submit', async e => {
      e.preventDefault();
      if (!e.target.reportValidity()) return;
      const d = Object.fromEntries(new FormData(e.target));
      try {
        await DB.update('users', yo.id, { telefono: d.telefono, direccion: d.direccion });
        const cambioEmail = !!d.email && d.email.trim().toLowerCase() !== yo.email;
        if (cambioEmail) await Auth.cambiarEmail(d.email);
        toast(cambioEmail ? 'Datos guardados. Para cambiar el email tocá el link que te enviamos a la casilla nueva.' : 'Datos actualizados');
      } catch (err) { toast(err.message, 'error'); }
    });
    $('#f-pass').addEventListener('submit', async e => {
      e.preventDefault();
      if (!e.target.reportValidity()) return;
      const d = Object.fromEntries(new FormData(e.target));
      try {
        if (d.nueva !== d.repetir) throw new Error('Las contraseñas nuevas no coinciden');
        if (!await Auth.checkPassword(d.actual)) throw new Error('La contraseña actual no es correcta');
        await Auth.setPassword(d.nueva);
        e.target.reset();
        toast('Contraseña actualizada');
      } catch (err) { toast(err.message, 'error'); }
    });
  },
};

function tarjetasPolizas(lista) {
  if (!lista.length) return '<div class="empty">No tenés pólizas para mostrar.</div>';
  return `<div class="policies">${lista.map(p => `
    <div class="policy">
      <div class="top"><h3>${esc(p.ramo)}</h3>${badge(estadoPoliza(p))}</div>
      <div><strong>${esc(p.bien)}</strong></div>
      <div class="meta">${esc(p.compania)} · Póliza N° ${esc(p.numero)}<br>
        ${p.cobertura ? esc(p.cobertura) + '<br>' : ''}
        Vigencia: ${fdate(p.vigenciaDesde)} al ${fdate(p.vigenciaHasta)}<br>
        Cuota: ${money(p.prima)}${p.suma ? ' · Suma asegurada: ' + money(p.suma) : ''}</div>
      <div class="actions">
        ${p.archivo ? `<button class="btn sm" data-act="verPoliza" data-id="${p.id}">👁 Ver póliza</button>
          <button class="btn sm ghost" data-act="descargarPoliza" data-id="${p.id}">⬇ Descargar</button>` : ''}
        <button class="btn sm ${p.archivo ? 'ghost' : ''}" data-act="certificado" data-id="${p.id}">📄 Certificado de cobertura</button>
      </div>
    </div>`).join('')}</div>`;
}

const acciones = {
  verPoliza(id) { const p = miPoliza(id); if (p?.archivo) return verArchivo(p.archivo); },
  descargarPoliza(id) { const p = miPoliza(id); if (p?.archivo) return descargar(p.archivo); },
  certificado(id) { const p = miPoliza(id); if (p) imprimirCertificado(p, yo); },

  async informarPago(id) {
    const p = DB.get('pagos', id);
    if (!p || p.clienteId !== yo.id) return;
    modal(`Informar pago · ${p.periodo} · ${money(p.monto)}`, `<div class="form-grid">
      ${campo('Fecha de pago', 'fechaPago', { type: 'date', value: hoyISO(), required: true })}
      ${campo('Medio de pago', 'medio', { options: MEDIOS })}
      ${campo('Comprobante', 'comprobante', { type: 'file', required: true, full: true, attrs: 'accept=".pdf,image/*"', hint: 'Foto o PDF del comprobante (máx. 1,5 MB)' })}
      ${campo('Comentario (opcional)', 'nota', { full: true })}
    </div>`, async d => {
      if (!archivoElegido(d.comprobante)) throw new Error('Adjuntá el comprobante');
      const comprobante = await subirSiHay(d.comprobante, yo.id);
      await DB.update('pagos', id, { estado: 'informado', fechaPago: d.fechaPago, medio: d.medio, nota: d.nota, comprobante });
      toast('¡Gracias! Tu productor va a confirmar el pago.');
      await refrescar();
    }, 'Enviar');
  },

  async pedirPresupuesto() {
    modal('Pedir presupuesto', `<div class="form-grid">
      ${campo('¿Qué querés asegurar?', 'ramo', { options: CONFIG.ramos, full: true })}
      ${campo('Detalle', 'detalle', { type: 'textarea', required: true, full: true,
        attrs: 'placeholder="Ej: auto marca, modelo, año, localidad y uso / tipo de vivienda / actividad del comercio…"' })}
    </div>`, async d => {
      await DB.insert('presupuestos', { clienteId: yo.id, ramo: d.ramo, detalle: d.detalle, estado: 'nuevo' });
      toast('Solicitud enviada. Te avisamos cuando esté la propuesta.');
      location.hash = '#presupuestos';
      await refrescar();
    }, 'Enviar solicitud');
  },

  descargarPresupuesto(id) { const p = DB.get('presupuestos', id); if (p?.clienteId === yo.id && p.archivo) return descargar(p.archivo); },

  async aceptarPresupuesto(id) {
    if (!confirmar('¿Aceptás esta propuesta? Tu productor se va a comunicar para avanzar con la emisión.')) return;
    await DB.update('presupuestos', id, { estado: 'aceptado' });
    toast('¡Listo! Tu productor fue notificado.');
    await refrescar();
  },

  async rechazarPresupuesto(id) {
    await DB.update('presupuestos', id, { estado: 'rechazado' });
    await refrescar();
  },

  async denunciarSiniestro() {
    const pols = misPolizas().filter(p => estadoPoliza(p) !== 'anulada');
    if (!pols.length) return toast('No tenés pólizas para denunciar un siniestro', 'error');
    modal('Denunciar siniestro', `<div class="form-grid">
      ${campo('Póliza', 'polizaId', { full: true, options: pols.map(p => [p.id, `${polizaLabel(p)} — ${p.bien}`]) })}
      ${campo('Tipo de siniestro', 'tipo', { options: TIPOS_SINIESTRO })}
      ${campo('Fecha del hecho', 'fecha', { type: 'date', value: hoyISO(), required: true, attrs: `max="${hoyISO()}"` })}
      ${campo('Lugar', 'lugar', { full: true, attrs: 'placeholder="Calle, altura y localidad"' })}
      ${campo('¿Qué pasó?', 'descripcion', { type: 'textarea', required: true, full: true,
        attrs: 'placeholder="Contanos cómo ocurrió. Si hubo terceros, incluí nombre, patente, compañía y póliza del otro vehículo."' })}
      ${campo('Fotos o documentación', 'archivo', { type: 'file', full: true, attrs: 'accept=".pdf,image/*"', hint: 'Opcional, máx. 1,5 MB' })}
    </div>`, async d => {
      await DB.insert('siniestros', { clienteId: yo.id, polizaId: d.polizaId, tipo: d.tipo, fecha: d.fecha, lugar: d.lugar, descripcion: d.descripcion,
        archivo: await subirSiHay(d.archivo, yo.id), estado: 'denunciado', notas: [] });
      toast('Siniestro enviado. Tu productor se va a comunicar con vos.');
      location.hash = '#siniestros';
      await refrescar();
    }, 'Enviar denuncia');
  },
};

(async () => {
  if (!CONFIGURADO) return pantallaSinConfigurar();
  yo = await Auth.require('cliente');
  $$('[data-cfg]').forEach(el => { el.textContent = CONFIG[el.dataset.cfg]; });
  $('#user-name').textContent = yo.nombre;
  document.title = 'Mi portal · ' + CONFIG.marca;
  conectarAcciones(acciones);
  refrescar = iniciarRouter(vistas, 'inicio', async () => {
    await DB.cargar();
    yo = DB.get('users', yo.id) || yo;
    if (yo.bloqueado) await Auth.logout();
  });
})();
