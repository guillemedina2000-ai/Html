// Datos del productor: editá estos valores con la información real.
const CONFIG = {
  // Datos del proyecto de Supabase (Project Settings → API Keys). La clave publishable es pública: puede ir acá.
  supabaseUrl: 'https://rishoiqmmtwvoqbkunyc.supabase.co',
  supabaseKey: 'sb_publishable_JJBc0oOANBBZqSbwPmepxQ_ECkWJ5MP',

  marca: 'Medina Seguros',
  productor: 'Productor Asesor de Seguros',
  matricula: 'Matrícula SSN N° 00000',
  telefono: '11 6352-4041',
  whatsapp: '5491163524041', // solo números, con código de país
  email: 'gmedina@medinaseguros.com',
  direccion: 'Buenos Aires, Argentina',
  horario: 'Lunes a viernes de 9 a 18 hs',
  datosPago: 'Transferencia a Alias: MEDINA.SEGUROS · CBU 0000000000000000000000 · o abonando directamente en la compañía.',
  ramos: ['Auto', 'Moto', 'Hogar', 'Vida', 'Accidentes personales', 'Comercio', 'ART', 'Caución', 'Otro'],
  companias: ['Sancor', 'La Segunda', 'Federación Patronal', 'Mercantil Andina', 'Rivadavia', 'Allianz', 'Zurich', 'San Cristóbal', 'Otra'],

  // Fotos del sitio (gratuitas, de Unsplash). Para cambiar una, reemplazá el código "photo-…" por el de otra foto de unsplash.com
  fotos: {
    portada: 'photo-1511895426328-dc8714191300',
    auto: 'photo-1503376780353-7e6692767b70',
    moto: 'photo-1558981806-ec527fa84c39',
    hogar: 'photo-1568605114967-8130f3a36994',
    vida: 'photo-1609220136736-443140cffec6',
    comercio: 'photo-1441986300917-64674bd600d8',
    art: 'photo-1504307651254-35680f356dfd',
    portal: 'photo-1450101499163-c8848c66ca85',
    cotizar: 'photo-1521791136064-7986c2920216',
    ingreso: 'photo-1449965408869-eaa3f722e40d',
  },
};

const foto = (clave, ancho = 1200) => `https://images.unsplash.com/${CONFIG.fotos[clave]}?auto=format&fit=crop&w=${ancho}&q=70`;
