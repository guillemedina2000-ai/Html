# Portal de seguros – Productor Asesor

Sitio web para un productor de seguros con:

- **Sitio público** (`index.html`): presentación, tipos de seguro, formulario para pedir presupuesto, contacto y botón de WhatsApp.
- **Panel del productor** (`admin.html`): clientes, pólizas (con PDF), cuotas y pagos, presupuestos, siniestros, recordatorios por WhatsApp, renovaciones, importación de clientes desde Excel, carga masiva de PDFs y copia de seguridad.
- **Portal del cliente** (`cliente.html`, se ingresa con email o DNI): ver y descargar sus pólizas, certificado de cobertura, ver pagos e informar pagos con comprobante, pedir y aceptar presupuestos, denunciar siniestros y seguir su estado, cambiar sus datos y contraseña.

Los datos, usuarios y archivos se guardan en **Supabase**, así que el productor y cada cliente pueden entrar desde cualquier computadora o celular. Cada cliente ve solamente sus propios datos; esas reglas están en la base de datos (`supabase/schema.sql`), no solo en la página.

## Puesta en marcha

Seguí los pasos de **[SUPABASE.md](SUPABASE.md)**: crear el proyecto, cargar `supabase/schema.sql`, crear el usuario del productor, completar `js/config.js` y publicar la página.

## Personalizar

Editá `js/config.js`: conexión a Supabase, nombre, matrícula SSN, teléfono, WhatsApp, email, datos para pagar, ramos y compañías.

## Estructura

```
index.html            Sitio público
login.html            Ingreso y recuperación de contraseña
admin.html            Panel del productor
cliente.html          Portal del cliente
css/styles.css        Estilos
js/config.js          Datos del productor y conexión a Supabase
js/store.js           Acceso a datos, archivos y usuarios (Supabase)
js/ui.js              Utilidades de interfaz
js/admin.js           Lógica del panel
js/cliente.js         Lógica del portal
js/carga.js           Importar Excel y cargar PDFs en cantidad
supabase/schema.sql   Tablas, reglas de seguridad y almacenamiento de archivos
```
