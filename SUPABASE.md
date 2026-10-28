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
2. Desactivá **Confirm email** y guardá. Así los clientes que da de alta el productor pueden entrar directamente con la contraseña que les pasa.
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

## Uso diario

- **Dar de alta un cliente**: Panel → Clientes → *Nuevo cliente*. Al guardar aparece un mensaje con los datos de acceso para mandárselos por WhatsApp o email.
- **Si un cliente se olvida la contraseña**: puede tocar *Olvidé mi contraseña* al ingresar, o el productor le manda el link desde la ficha del cliente (*Enviar cambio de contraseña*).
- **Deshabilitar acceso**: desde la ficha del cliente. El cliente deja de ver sus datos al instante, pero no se borra nada.
- **Eliminar un cliente**: borra sus pólizas, pagos, presupuestos y siniestros. Si además querés borrar su usuario para siempre (por ejemplo para volver a crearlo con el mismo email), hacelo en Supabase → Authentication → Users.

## Cosas a tener en cuenta

- **Pausa por inactividad**: en el plan gratuito, Supabase pausa el proyecto si pasa una semana sin que nadie lo use. Con uso normal no pasa; si pasa, se reactiva desde el panel de Supabase con un clic y no se pierde nada. El plan pago (USD 25/mes) no se pausa nunca.
- **Emails**: Supabase manda los emails de recuperación de contraseña con su propio servidor, que permite pocos envíos por hora. Si se quedan cortos, se puede configurar un servicio de email propio en Authentication → Emails → SMTP Settings. Ahí también se pueden traducir los textos de los emails al español.
- **Copias de seguridad**: el plan gratuito no guarda copias automáticas. Desde el panel → Ajustes → *Descargar copia* se baja un archivo con todos los datos; conviene hacerlo cada tanto.
