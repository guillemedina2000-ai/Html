// Carga masiva para el productor: importar clientes y pólizas desde un Excel,
// y subir muchos PDF de pólizas de una vez. Agrega pantallas al panel (admin.js).

const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

function cargarScript(url) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some(s => s.src === url)) return resolve();
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel. Revisá tu conexión.'));
    document.head.appendChild(s);
  });
}

// Texto sin tildes, en minúscula y sin signos: "N° Póliza" → "n poliza"
const normalizar = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Solo letras y números en mayúscula, para comparar números de póliza, patentes, etc.
const compacto = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ---------- Interpretar valores del Excel ----------

function aFechaISO(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !isNaN(v)) {
    return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  }
  if (typeof v === 'number' && v > 1 && v < 80000) return aFechaISO(new Date(Math.round((v - 25569) * 86400000) + new Date().getTimezoneOffset() * 60000));
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const anio = m[3].length === 2 ? (+m[3] > 50 ? '19' : '20') + m[3] : m[3];
    return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

function aNumero(v) {
  if (typeof v === 'number') return v;
  let t = String(v ?? '').replace(/[^\d.,-]/g, '');
  if (!t) return 0;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');      // 12.345,67
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');     // 12.345
  return +t || 0;
}

function aRamo(v) {
  const t = normalizar(v);
  if (!t) return 'Otro';
  const reglas = [[/\bmotos?\b|motocicleta|ciclomotor/, 'Moto'], [/auto|vehiculo|camion|pick/, 'Auto'], [/hogar|combinado|vivienda|casa|depto|departamento/, 'Hogar'],
    [/accidente|\bap\b/, 'Accidentes personales'], [/vida|sepelio/, 'Vida'], [/comercio|integral|consorcio|industria/, 'Comercio'],
    [/\bart\b|\ba r t\b|riesgos del trabajo/, 'ART'], [/caucion/, 'Caución']];
  const r = reglas.find(([re]) => re.test(t));
  return r ? r[1] : (CONFIG.ramos.find(x => normalizar(x) === t) || 'Otro');
}

// ---------- Columnas ----------

const CAMPOS_IMPORT = [
  { k: 'nombre', t: 'Nombre y apellido', s: ['apellido y nombre', 'nombre y apellido', 'nombre completo', 'razon social', 'asegurado', 'cliente', 'tomador', 'nombre'] },
  { k: 'apellido', t: 'Apellido (si está en otra columna)', s: ['apellido', 'apellidos'] },
  { k: 'dni', t: 'DNI / CUIT', s: ['dni', 'cuit', 'cuil', 'documento', 'nro documento', 'nro doc', 'doc'] },
  { k: 'email', t: 'Email', s: ['email', 'e mail', 'mail', 'correo', 'correo electronico'] },
  { k: 'telefono', t: 'Teléfono / celular', s: ['celular', 'telefono', 'tel', 'whatsapp', 'movil', 'cel', 'contacto'] },
  { k: 'direccion', t: 'Dirección', s: ['direccion', 'domicilio', 'calle'] },
  { k: 'nacimiento', t: 'Fecha de nacimiento', s: ['fecha de nacimiento', 'fecha nacimiento', 'nacimiento', 'fecha nac', 'f nac'] },
  { k: 'compania', t: 'Compañía', s: ['compania', 'aseguradora', 'cia', 'empresa'] },
  { k: 'numero', t: 'N° de póliza', s: ['n poliza', 'nro poliza', 'numero de poliza', 'numero poliza', 'poliza', 'n de poliza'] },
  { k: 'ramo', t: 'Ramo / tipo de seguro', s: ['ramo', 'tipo de seguro', 'seccion', 'producto', 'tipo', 'riesgo'] },
  { k: 'bien', t: 'Bien asegurado (vehículo, casa…)', s: ['bien asegurado', 'bien', 'vehiculo', 'marca y modelo', 'modelo', 'objeto', 'ubicacion del riesgo', 'ubicacion', 'descripcion'] },
  { k: 'patente', t: 'Patente', s: ['patente', 'dominio'] },
  { k: 'cobertura', t: 'Cobertura', s: ['cobertura', 'plan'] },
  { k: 'vigenciaDesde', t: 'Vigencia desde', s: ['vigencia desde', 'inicio vigencia', 'fecha inicio', 'desde', 'inicio', 'alta'] },
  { k: 'vigenciaHasta', t: 'Vigencia hasta', s: ['vigencia hasta', 'fin vigencia', 'fecha fin', 'fecha vencimiento', 'hasta', 'vencimiento', 'vto'] },
  { k: 'prima', t: 'Cuota mensual ($)', s: ['cuota mensual', 'cuota', 'premio', 'prima', 'importe', 'monto', 'valor'] },
  { k: 'suma', t: 'Suma asegurada ($)', s: ['suma asegurada', 'suma'] },
];

// Adivina qué columna del Excel corresponde a cada dato: primero coincidencias exactas, después parciales
function adivinarColumnas(encabezados) {
  const norm = encabezados.map(normalizar);
  const usados = new Set();
  const mapa = {};
  for (const exacta of [true, false]) {
    for (const c of CAMPOS_IMPORT) {
      if (mapa[c.k] !== undefined) continue;
      for (const sin of c.s) {
        const i = norm.findIndex((h, j) => !usados.has(j) && h && (exacta ? h === sin : (' ' + h + ' ').includes(' ' + sin + ' ')));
        if (i >= 0) { mapa[c.k] = i; usados.add(i); break; }
      }
    }
  }
  return mapa;
}

// Agrupa las filas por cliente (por DNI, si no por email, si no por nombre) y arma sus pólizas
function armarImportacion(filas, mapa) {
  const val = (fila, k) => mapa[k] === undefined || mapa[k] === '' ? '' : fila[mapa[k]];
  const texto = (fila, k) => String(val(fila, k) ?? '').trim();
  const existentesPorClave = new Map();
  clientes().forEach(c => {
    if (soloDigitos(c.dni).length >= 6) existentesPorClave.set('dni:' + soloDigitos(c.dni), c);
    if (c.email && !entraConDni(c)) existentesPorClave.set('mail:' + c.email.toLowerCase(), c);
  });

  const grupos = new Map();
  const errores = [];
  filas.forEach((fila, i) => {
    const nFila = i + 2;  // +1 por el encabezado, +1 porque Excel empieza en 1
    let nombre = texto(fila, 'nombre');
    const apellido = texto(fila, 'apellido');
    if (apellido && !normalizar(nombre).includes(normalizar(apellido))) nombre = (apellido + ' ' + nombre).trim();
    const dni = soloDigitos(texto(fila, 'dni'));
    const email = texto(fila, 'email').toLowerCase();
    const emailValido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!nombre && !dni && !email) return;  // fila vacía
    if (!nombre) return errores.push(`Fila ${nFila}: falta el nombre`);
    if (!emailValido && dni.length < 6) return errores.push(`Fila ${nFila} (${nombre}): falta DNI o email para que pueda ingresar`);

    const clave = dni.length >= 6 ? 'dni:' + dni : 'mail:' + email;
    if (!grupos.has(clave)) {
      const existente = existentesPorClave.get(clave) || (emailValido && existentesPorClave.get('mail:' + email));
      grupos.set(clave, {
        existente, fila: nFila,
        datos: { nombre, dni: texto(fila, 'dni'), email: emailValido ? email : '', telefono: texto(fila, 'telefono'),
          direccion: texto(fila, 'direccion'), nacimiento: aFechaISO(val(fila, 'nacimiento')) },
        polizas: [],
      });
    }
    const g = grupos.get(clave);

    const numero = texto(fila, 'numero'), compania = texto(fila, 'compania');
    if (!numero && !compania) return;  // fila solo con datos del cliente
    let desde = aFechaISO(val(fila, 'vigenciaDesde'));
    let hasta = aFechaISO(val(fila, 'vigenciaHasta'));
    if (!desde && hasta) desde = sumarMeses(hasta, -12);
    if (!desde) desde = hoyISO();
    if (!hasta || hasta < desde) hasta = sumarMeses(desde, 12);
    const ramo = aRamo(texto(fila, 'ramo') || texto(fila, 'bien'));
    const bien = [texto(fila, 'bien'), texto(fila, 'patente').toUpperCase()].filter(Boolean).join(' - ') || ramo;
    g.polizas.push({ ramo, compania: compania || 'Sin especificar', numero: numero || 'S/N', bien, cobertura: texto(fila, 'cobertura'),
      vigenciaDesde: desde, vigenciaHasta: hasta, prima: aNumero(val(fila, 'prima')), suma: aNumero(val(fila, 'suma')), estado: 'activa' });
  });

  // No repetir pólizas que ya están cargadas (mismo cliente y número)
  for (const g of grupos.values()) {
    if (!g.existente) continue;
    const ya = new Set(DB.where('polizas', p => p.clienteId === g.existente.id).map(p => compacto(p.numero)));
    g.polizas = g.polizas.filter(p => p.numero === 'S/N' || !ya.has(compacto(p.numero)));
  }
  return { grupos: [...grupos.values()], errores };
}

function descargarCsv(nombre, filas) {
  const csv = filas.map(f => f.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// ---------- Pantalla: importar Excel ----------

Object.assign(vistas, {
  importar() {
    render(`
      <div class="page-head"><h1>Importar clientes desde Excel</h1><a class="btn ghost" href="#clientes">← Volver</a></div>
      <div class="card">
        <h2>1. Elegí el archivo</h2>
        <p class="muted">Sirve un Excel (.xlsx o .xls) o un .csv. La primera fila tiene que tener los títulos de las columnas (Nombre, DNI, Teléfono, Póliza, Compañía, etc.).
          Si un cliente tiene varias pólizas, puede aparecer en varias filas con el mismo DNI.</p>
        <input type="file" id="archivo-excel" accept=".xlsx,.xls,.csv">
      </div>
      <div id="paso-columnas"></div>
      <div id="paso-revision"></div>`);
    $('#archivo-excel').addEventListener('change', e => leerExcel(e.target.files[0]).catch(err => toast(err.message, 'error')));
  },
});

let importacion = null;

async function leerExcel(file) {
  if (!file) return;
  await cargarScript(XLSX_URL);
  const libro = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: true }).filter(f => f.some(c => String(c).trim() !== ''));
  if (filas.length < 2) throw new Error('El archivo no tiene datos (se necesita una fila de títulos y al menos una fila de clientes).');
  const encabezados = filas[0].map((h, i) => String(h).trim() || `Columna ${i + 1}`);
  importacion = { encabezados, filas: filas.slice(1), mapa: adivinarColumnas(encabezados) };
  pintarColumnas();
}

function pintarColumnas() {
  const { encabezados, filas, mapa } = importacion;
  const opciones = [['', '— No está en el Excel —'], ...encabezados.map((h, i) => [String(i), h])];
  $('#paso-columnas').innerHTML = `
    <div class="card">
      <h2>2. Revisá las columnas</h2>
      <p class="muted">Encontramos ${filas.length} filas. Ya elegimos la columna de cada dato; corregí lo que no corresponda.</p>
      <div class="form-grid" id="mapeo">
        ${CAMPOS_IMPORT.map(c => campo(c.t, c.k, { value: mapa[c.k] ?? '', options: opciones })).join('')}
      </div>
      <label style="display:flex;gap:8px;align-items:center;margin-top:16px"><input type="checkbox" id="gen-cuotas"> Generar las cuotas mensuales de cada póliza (para controlar pagos desde el portal)</label>
      <div class="actions" style="margin-top:16px"><button class="btn" id="btn-revisar">Ver vista previa</button></div>
    </div>`;
  $('#btn-revisar').onclick = () => {
    $$('#mapeo select').forEach(s => { importacion.mapa[s.name] = s.value === '' ? undefined : +s.value; });
    if (importacion.mapa.nombre === undefined) return toast('Elegí al menos la columna del nombre', 'error');
    pintarRevision();
  };
}

function pintarRevision() {
  const { grupos, errores } = armarImportacion(importacion.filas, importacion.mapa);
  importacion.grupos = grupos;
  const nuevos = grupos.filter(g => !g.existente);
  const totalPolizas = grupos.reduce((s, g) => s + g.polizas.length, 0);
  const usuario = d => d.email || 'DNI ' + soloDigitos(d.dni);
  $('#paso-revision').innerHTML = `
    <div class="card">
      <h2>3. Confirmá</h2>
      <div class="stats">
        <div class="stat"><div class="n">${nuevos.length}</div><div class="l">Clientes nuevos</div></div>
        <div class="stat"><div class="n">${grupos.length - nuevos.length}</div><div class="l">Ya estaban cargados (solo se agregan sus pólizas)</div></div>
        <div class="stat"><div class="n">${totalPolizas}</div><div class="l">Pólizas nuevas</div></div>
        <div class="stat ${errores.length ? 'alert' : ''}"><div class="n">${errores.length}</div><div class="l">Filas con problemas (no se importan)</div></div>
      </div>
      ${errores.length ? `<div class="notice">${errores.slice(0, 50).map(esc).join('<br>')}${errores.length > 50 ? `<br>…y ${errores.length - 50} más` : ''}</div>` : ''}
      ${tabla(['Cliente', 'DNI', 'Teléfono', 'Usuario', 'Pólizas', ''], grupos.slice(0, 200).map(g => [
        esc(g.datos.nombre), esc(g.datos.dni || '-'), esc(g.datos.telefono || '-'), esc(g.existente ? usuarioVisible(g.existente) : usuario(g.datos)),
        g.polizas.map(p => esc(`${p.ramo} · ${p.compania} · ${p.numero}`)).join('<br>') || '-',
        g.existente ? badge('ya existe') : badge('nuevo')]), 'No hay clientes para importar.')}
      ${grupos.length > 200 ? `<p class="muted">Se muestran los primeros 200 de ${grupos.length}.</p>` : ''}
      <p class="muted">A cada cliente nuevo se le crea un usuario con una contraseña al azar. Al terminar vas a poder descargar la lista de accesos
        para mandárselos, o mandarle el acceso a cada uno desde su ficha con “🔑 Enviar acceso”.</p>
      <div class="actions"><button class="btn" id="btn-importar" ${grupos.length ? '' : 'disabled'}>Importar ${nuevos.length} clientes y ${totalPolizas} pólizas</button></div>
      <div id="progreso"></div>
    </div>`;
  $('#btn-importar').onclick = () => ejecutarImportacion().catch(err => toast(err.message, 'error'));
}

async function ejecutarImportacion() {
  const grupos = importacion.grupos;
  const generar = $('#gen-cuotas').checked;
  $('#btn-importar').disabled = true;
  $$('#mapeo select, #gen-cuotas, #archivo-excel').forEach(el => { el.disabled = true; });
  const prog = $('#progreso');
  const accesos = [['Nombre', 'Teléfono', 'Usuario', 'Contraseña', 'Mensaje para enviar']];
  const fallas = [];
  let hechos = 0, polizasCreadas = 0;
  const pintar = () => {
    prog.innerHTML = `<p style="margin-top:16px"><strong>Importando… ${hechos} de ${grupos.length}</strong></p>
      <div style="background:var(--border);border-radius:99px;height:10px"><div style="background:var(--brand);height:10px;border-radius:99px;width:${Math.round(hechos / grupos.length * 100)}%"></div></div>`;
  };
  pintar();

  for (const g of grupos) {
    try {
      let id = g.existente?.id;
      if (!id) {
        const password = contrasenaAleatoria();
        id = await Auth.crearCliente(g.datos, password);
        const c = { ...g.datos, email: g.datos.email || emailDeDni(g.datos.dni) };
        accesos.push([g.datos.nombre, g.datos.telefono, usuarioVisible(c), password, mensajeAcceso(c, password)]);
      }
      if (g.polizas.length) {
        const creadas = await DB.insertMany('polizas', g.polizas.map(p => ({ ...p, clienteId: id })));
        polizasCreadas += creadas.length;
        if (generar) for (const p of creadas) await generarCuotas(p, 12);
      }
    } catch (err) {
      fallas.push(`${g.datos.nombre} (fila ${g.fila}): ${err.message}`);
    }
    hechos++;
    pintar();
  }

  const creados = accesos.length - 1;
  prog.innerHTML = `
    <div class="notice info" style="margin-top:16px">✅ Listo: ${creados} clientes nuevos y ${polizasCreadas} pólizas cargadas.</div>
    ${fallas.length ? `<div class="notice">No se pudieron importar ${fallas.length}:<br>${fallas.map(esc).join('<br>')}</div>` : ''}
    <div class="actions">
      ${creados ? '<button class="btn" id="btn-accesos">⬇ Descargar lista de accesos (Excel)</button>' : ''}
      <a class="btn ghost" href="#clientes">Ir a Clientes</a>
      <a class="btn ghost" href="#pdfs">📎 Cargar los PDF de las pólizas</a>
    </div>
    ${creados ? '<p class="muted">Guardá la lista de accesos: por seguridad las contraseñas no se pueden volver a ver (sí se puede generar una nueva).</p>' : ''}`;
  if (creados) $('#btn-accesos').onclick = () => descargarCsv(`accesos-clientes-${hoyISO()}.csv`, accesos);
  await DB.cargar();
  actualizarContadores();
}

// ---------- Pantalla: cargar PDFs de pólizas ----------

Object.assign(vistas, {
  pdfs() {
    render(`
      <div class="page-head"><h1>Cargar PDFs de pólizas</h1><a class="btn ghost" href="#polizas">← Volver</a></div>
      <div class="card">
        <p>Elegí todos los PDF juntos (podés seleccionar varios con <strong>Ctrl</strong> o arrastrarlos acá). Para cada archivo buscamos la póliza
          por el <strong>número de póliza</strong>, la <strong>patente</strong>, el <strong>DNI</strong> o el <strong>apellido</strong> que aparezca en el nombre del archivo.
          Revisá y corregí antes de subir.</p>
        <label id="zona-pdfs" style="display:block;border:2px dashed var(--border);border-radius:12px;padding:30px;text-align:center;cursor:pointer">
          📎 Tocá para elegir los archivos o arrastralos acá
          <input type="file" id="input-pdfs" multiple accept=".pdf,image/*" hidden>
        </label>
        <div id="lista-pdfs"></div>
      </div>`);
    const zona = $('#zona-pdfs');
    $('#input-pdfs').addEventListener('change', e => prepararPdfs([...e.target.files]));
    zona.addEventListener('dragover', e => { e.preventDefault(); zona.style.borderColor = 'var(--brand)'; });
    zona.addEventListener('dragleave', () => { zona.style.borderColor = ''; });
    zona.addEventListener('drop', e => { e.preventDefault(); zona.style.borderColor = ''; prepararPdfs([...e.dataTransfer.files]); });
  },
});

const PATENTE = /\b([A-Z]{2}\s?-?\d{3}\s?-?[A-Z]{2}|[A-Z]{3}\s?-?\d{3})\b/gi;

// Puntaje de qué tanto el nombre de un archivo se parece a una póliza
function puntajePoliza(nombreArchivo, p) {
  const f = compacto(nombreArchivo.replace(/\.[^.]+$/, ''));
  const c = DB.get('users', p.clienteId) || {};
  let pts = 0;
  const num = compacto(p.numero);
  if (num.length >= 4 && f.includes(num)) pts += 10;
  for (const pat of String(p.bien || '').match(PATENTE) || []) if (f.includes(compacto(pat))) pts += 8;
  const dni = soloDigitos(c.dni);
  if (dni.length >= 7 && f.includes(dni)) pts += 5;
  const palabras = normalizar(c.nombre).split(' ').filter(w => w.length >= 4);
  pts += Math.min(4, palabras.filter(w => f.includes(compacto(w))).length * 2);
  if (pts && f.includes(compacto(p.ramo))) pts += 1;
  return pts;
}

function sugerirPoliza(nombreArchivo, polizas) {
  const ranking = polizas.map(p => [p, puntajePoliza(nombreArchivo, p)]).filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]);
  if (!ranking.length) return null;
  if (ranking[1] && ranking[1][1] === ranking[0][1]) return null;  // empate: que elija el productor
  return ranking[0][0];
}

let archivosPdf = [];

function prepararPdfs(files) {
  const polizas = DB.all('polizas').sort((a, b) => nombreCliente(a.clienteId).localeCompare(nombreCliente(b.clienteId)));
  if (!polizas.length) return toast('Primero cargá las pólizas (a mano o importando el Excel)', 'error');
  archivosPdf = files.filter(f => f.size).map(f => ({ file: f, polizaId: sugerirPoliza(f.name, polizas)?.id || '', estado: '' }));
  const opciones = [['', '— Elegir póliza —'], ...polizas.map(p => [p.id, `${nombreCliente(p.clienteId)} — ${p.ramo} · ${p.compania} · N° ${p.numero}${p.archivo ? ' (ya tiene PDF)' : ''}`])];
  const encontrados = archivosPdf.filter(a => a.polizaId).length;
  $('#lista-pdfs').innerHTML = `
    <p style="margin-top:16px"><strong>${archivosPdf.length} archivos</strong> · reconocimos ${encontrados} automáticamente${archivosPdf.length - encontrados ? `, elegí la póliza de los otros ${archivosPdf.length - encontrados}` : ''}.</p>
    ${tabla(['Archivo', 'Póliza', 'Estado'], archivosPdf.map((a, i) => [
      `${esc(a.file.name)}<br><small class="muted">${(a.file.size / 1024 / 1024).toFixed(1)} MB</small>`,
      `<select data-i="${i}" class="sel-pdf" style="min-width:260px">${opciones.map(([v, t]) => `<option value="${v}" ${v === a.polizaId ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`,
      `<span id="estado-pdf-${i}">${a.polizaId ? badge('reconocido') : badge('sin asignar')}</span>`]))}
    <p class="muted">Si una póliza ya tenía PDF, se reemplaza por el nuevo. Los que queden “sin asignar” no se suben.</p>
    <div class="actions"><button class="btn" id="btn-subir-pdfs">Subir PDFs</button></div>`;
  $$('.sel-pdf').forEach(s => s.addEventListener('change', () => {
    archivosPdf[+s.dataset.i].polizaId = s.value;
    $('#estado-pdf-' + s.dataset.i).innerHTML = s.value ? badge('elegido') : badge('sin asignar');
  }));
  $('#btn-subir-pdfs').onclick = () => subirPdfs().catch(err => toast(err.message, 'error'));
}

async function subirPdfs() {
  const pendientes = archivosPdf.map((a, i) => ({ ...a, i })).filter(a => a.polizaId);
  if (!pendientes.length) return toast('No hay archivos asignados a ninguna póliza', 'error');
  const repetidas = pendientes.filter((a, j) => pendientes.findIndex(b => b.polizaId === a.polizaId) !== j);
  if (repetidas.length && !confirmar('Hay pólizas elegidas para más de un archivo: va a quedar el último. ¿Continuar?')) return;
  $('#btn-subir-pdfs').disabled = true;
  $$('.sel-pdf').forEach(s => { s.disabled = true; });
  let ok = 0;
  for (const a of pendientes) {
    const estado = $('#estado-pdf-' + a.i);
    estado.innerHTML = badge('subiendo…');
    try {
      const p = DB.get('polizas', a.polizaId);
      const archivo = await Archivos.subir(archivoElegido(a.file), p.clienteId);
      await DB.update('polizas', p.id, { archivo });
      estado.innerHTML = badge('subido');
      ok++;
    } catch (err) {
      estado.innerHTML = `${badge('error')}<br><small>${esc(err.message)}</small>`;
    }
  }
  toast(`${ok} de ${pendientes.length} PDFs subidos`);
  $('#lista-pdfs').insertAdjacentHTML('beforeend', `<div class="actions" style="margin-top:12px"><a class="btn ghost" href="#polizas">Ir a Pólizas</a>
    <button class="btn ghost" onclick="location.reload()">Cargar más</button></div>`);
}
