# Portal de seguros – Productor Asesor

Sitio web para un productor de seguros con:

- **Sitio público** (`index.html`): presentación, tipos de seguro, formulario para pedir presupuesto, contacto y botón de WhatsApp.
- **Panel del productor** (`admin.html`): clientes, pólizas (con PDF), cuotas y pagos, presupuestos, siniestros, recordatorios por WhatsApp, renovaciones y copia de seguridad.
- **Portal del cliente** (`cliente.html`): ver y descargar sus pólizas, certificado de cobertura, ver pagos e informar pagos con comprobante, pedir y aceptar presupuestos, denunciar siniestros y seguir su estado, cambiar sus datos y contraseña.

## Probarlo

Abrí `index.html` en el navegador (o publicalo con GitHub Pages) y entrá en **Ingresar** con:

| Rol       | Email            | Contraseña |
|-----------|------------------|------------|
| Productor | admin@demo.com   | admin123   |
| Cliente   | cliente@demo.com | cliente123 |

Cambiá la contraseña del productor desde **Ajustes** antes de usarlo en serio.

## Personalizar

Editá `js/config.js`: nombre, matrícula SSN, teléfono, WhatsApp, email, datos para pagar, ramos y compañías.

## Importante: dónde se guardan los datos

Esta versión guarda todo **en el navegador** (localStorage). Sirve para probar y mostrar el sistema, pero:

- Los datos solo existen en la computadora/navegador donde se cargaron: un cliente que entra desde su celular **no** ve lo que el productor cargó en su PC.
- Usá **Ajustes → Descargar copia** para no perder información.

Para que productor y clientes compartan la información desde cualquier dispositivo, el siguiente paso es conectar una base de datos en la nube (por ejemplo Supabase o Firebase, ambos con plan gratuito). Todo el acceso a datos está concentrado en `js/store.js`, así que es el único archivo que hay que reemplazar.

## Estructura

```
index.html      Sitio público
login.html      Ingreso
admin.html      Panel del productor
cliente.html    Portal del cliente
css/styles.css  Estilos
js/config.js    Datos del productor
js/store.js     Datos y usuarios
js/ui.js        Utilidades de interfaz
js/admin.js     Lógica del panel
js/cliente.js   Lógica del portal
```
