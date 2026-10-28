# Cómo poner el portal en funcionamiento

Son unos 15 minutos y se hace una sola vez. Supabase es el servicio donde quedan guardados los usuarios, los datos y los archivos (PDF de pólizas, comprobantes, fotos). El plan gratuito alcanza de sobra para empezar.

## 1. Crear el proyecto en Supabase

1. Entrá a <https://supabase.com>, creá una cuenta (podés usar la de Google o GitHub) y tocá **New project**.
2. Poné un nombre (por ej. `seguros`), una contraseña para la base de datos (guardala, aunque no la vas a usar seguido) y elegí la región **South America (São Paulo)**.
3. Esperá un par de minutos a que termine de crearse.

## 2. Crear las tablas y la seguridad

1. En el menú de la izquierda entrá a **SQL Editor** → **New query**.
2. Abrí el archivo [`supabase/schema.sql`](supabase/schema.sql) de este repositorio, copiá **todo** el contenido, pegalo y tocá **Run**.
3. Tiene que decir *Success. No rows returned*.

Esto crea las tablas (clientes, pólizas, pagos, presupuestos, siniestros), la carpeta privada de archivos y las reglas para que **cada cliente vea solamente lo suyo**.

## 3. Configurar el ingreso por email

1. Entrá a **Authentication** → **Sign In / Providers** → **Email**.
2. En **Authentication** → **Sign In / Providers**, sección **User Signups**: desactivá **Allow new users to sign up** y **Confirm email**, y guardá. Las cuentas de los clientes las crea solamente el productor desde el panel, así nadie más puede registrarse.
3. Entrá a **Authentication** → **URL Configuration**:
   - **Site URL**: la dirección donde va a estar publicada la página (ver paso 6), por ejemplo `https://tuusuario.github.io/Html/`.
   - **Redirect URLs**: agregá esa misma dirección terminada en `**`, por ejemplo `https://tuusuario.github.io/Html/**`.

   Esto hace que los links de "olvidé mi contraseña" lleven a la página correcta.

## 4. Crear el usuario del productor

1. Entrá a **Authentication** → **Users** → **Add user** → **Create new user**.
2. Poné el email y la contraseña del productor y dejá tildado **Auto Confirm User**.
3. Volvé a **SQL Editor** → **New query**, pegá esto cambiando el email y el nombre, y tocá **Run**:

   ```sql
   update profiles set role = 'admin', nombre = 'Nombre del productor'
   where lower(email) = lower('email-del-productor@ejemplo.com');

   select email, nombre, role from profiles;
   ```

   Abajo tiene que aparecer el email del productor con `role` = `admin`. Desde ahora ese usuario entra al panel del productor; todos los demás usuarios son clientes.

## 5. Conectar la página con Supabase

1. En Supabase entrá a **Project Settings** → **API Keys** (en algunos proyectos figura como **API**).
2. Copiá la **Project URL** (algo como `https://abcdefgh.supabase.co`) y la clave **anon public** o **publishable** (empieza con `eyJ…` o con `sb_publishable_…`).
   > Esta clave es pública y puede ir en la página sin problema: la seguridad la dan las reglas del paso 2. **Nunca** copies la clave `service_role` ni la `secret`.
3. Abrí [`js/config.js`](js/config.js) y completá:

   ```js
   supabaseUrl: 'https://abcdefgh.supabase.co',
   supabaseKey: 'eyJ...la clave anon/publishable...',
   ```

4. Aprovechá para poner también los datos reales: nombre, matrícula SSN, teléfono, WhatsApp, email y datos para pagar.

## 6. Publicar la página

La forma más simple es **GitHub Pages** (gratis):

1. En GitHub, en este repositorio, entrá a **Settings** → **Pages**.
2. En **Branch** elegí la rama principal (`main`) y la carpeta `/ (root)`, y tocá **Save**.
3. En un par de minutos la página queda en `https://tuusuario.github.io/Html/`. Esa es la dirección que va en el paso 3.

> En el plan gratuito de GitHub, Pages funciona con repositorios públicos. No pasa nada porque el código sea público: no tiene contraseñas ni datos de clientes, todo eso está en Supabase.

También se puede publicar en Netlify, Vercel o Cloudflare Pages arrastrando la carpeta, o comprar un dominio propio (por ej. `medinaseguros.com.ar`) y apuntarlo a cualquiera de ellos.

## Actualizaciones

Cuando se agregan funciones nuevas puede hacer falta volver a ejecutar [`supabase/schema.sql`](supabase/schema.sql) en el **SQL Editor** (paso 2). Se puede ejecutar todas las veces que haga falta: no borra datos.

## Uso diario

- **Dar de alta un cliente**: Panel → Clientes → *Nuevo cliente*. Al guardar aparece un mensaje con los datos de acceso para mandárselos por WhatsApp o email. Si el cliente no tiene email, ingresa con su **DNI**.
- **Importar muchos clientes desde Excel**: Panel → Clientes → *📥 Importar Excel*. La página reconoce las columnas (nombre, DNI, teléfono, email, compañía, n° de póliza, patente, vigencia, etc.), muestra una vista previa y crea los clientes con sus pólizas. Al terminar se descarga una planilla con el usuario y la contraseña de cada cliente nuevo. Se puede volver a importar el mismo archivo actualizado: no duplica clientes ni pólizas.
- **Cargar los PDF de las pólizas**: Panel → Pólizas → *📎 Cargar PDFs*. Se eligen todos juntos y cada uno se asigna solo a su póliza si el nombre del archivo tiene el n° de póliza, la patente, el DNI o el apellido del cliente. Los que no se reconocen se eligen de una lista. Los clientes los ven desde *Mis pólizas → Ver póliza*, ideal para mostrarlos en un control.
- **Mandar el acceso o una contraseña nueva**: desde la ficha del cliente, *🔑 Enviar acceso*. Genera una contraseña nueva y arma el mensaje para WhatsApp. Los clientes con email también pueden usar *Olvidé mi contraseña* al ingresar.
- **Deshabilitar acceso**: desde la ficha del cliente. El cliente deja de ver sus datos al instante, pero no se borra nada.
- **Eliminar un cliente**: borra su usuario y todas sus pólizas, pagos, presupuestos y siniestros.

## Cosas a tener en cuenta

- **Pausa por inactividad**: en el plan gratuito, Supabase pausa el proyecto si pasa una semana sin que nadie lo use. Con uso normal no pasa; si pasa, se reactiva desde el panel de Supabase con un clic y no se pierde nada. El plan pago (USD 25/mes) no se pausa nunca.
- **Emails**: Supabase manda los emails de recuperación de contraseña con su propio servidor, que permite pocos envíos por hora. Si se quedan cortos, se puede configurar un servicio de email propio en Authentication → Emails → SMTP Settings. Ahí también se pueden traducir los textos de los emails al español.
- **Copias de seguridad**: el plan gratuito no guarda copias automáticas. Desde el panel → Ajustes → *Descargar copia* se baja un archivo con todos los datos; conviene hacerlo cada tanto.
