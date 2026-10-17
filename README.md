# PotTed — tienda en línea

Tienda de PotTed (pottedusa.com) con panel de administración. Un solo servicio de Node sirve la tienda, el panel y la API.

- **Tienda (en inglés):** portada, catálogo por categoría y por efecto (Indica, Sativa, Hybrid…), ficha de producto con sus lab results, carrito, checkout para EE. UU. con estados bloqueados, pago con PayPal en línea, Lab Results, blog, mayoristas, contacto, seguimiento de pedido, verificación de edad (21+), aviso de cookies y boletín.
- **Panel (`/admin`, en español):** pedidos, productos, categorías, destacados, clientes, envíos, pagos, cupones, lab results, blog, mensajes, suscriptores, páginas, portada, ajustes e importador del sitio anterior.

## Stack

React 19 + Vite + Tailwind 4 · Express + tRPC · Drizzle ORM + MySQL · PayPal Orders API · Cloudflare R2 · Resend

```
client/     Tienda y panel (React)
server/     API, PayPal, importador, correos, arranque
shared/     Tipos y utilidades compartidas
drizzle/    Esquema y migraciones
```

## Desplegar en Railway

1. **New Project → Deploy from GitHub repo** → `georgemontilva-crypto/potted`.
2. En el mismo proyecto: **New → Database → MySQL**.
3. En el servicio de la web, pestaña **Variables**:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` |
   | `JWT_SECRET` | cadena aleatoria de 32+ caracteres |
   | `ADMIN_EMAIL` | correo para entrar al panel |
   | `ADMIN_PASSWORD` | contraseña inicial del panel |
   | `PAYPAL_CLIENT_ID` | Client ID de la app de PayPal |
   | `PAYPAL_CLIENT_SECRET` | Secret de la app de PayPal |
   | `PAYPAL_MODE` | `sandbox` para probar, `live` para cobrar |

4. **Settings → Networking → Generate Domain**.
5. Entra a `https://tu-dominio/admin`.

En el primer arranque se aplican las migraciones y se crean el administrador, las 3 categorías, los 18 productos, los 109 lab results, las páginas, el envío USPS y los métodos de pago (PayPal activo, Zelle apagado).

### Antes de apuntar el dominio pottedusa.com a Railway

Entra a **Panel → Importar** y corre la importación **mientras el WordPress viejo siga en línea**. Copia a tu almacenamiento:

- los ~89 artículos del blog con sus imágenes,
- las páginas About Us, FDA and Hemp, Privacy, Shipping, Refund y Terms (las políticas quedan como borrador hasta importarlas),
- las fotos de productos que faltan (Violet Fog, Truffle Butter, Applescotti, Durban Poison) y cualquier producto nuevo,
- los PDF de lab results (hoy apuntan a `pottedusa.com/wp-content/...`).

Si el dominio ya apunta a Railway, pon en el importador una dirección temporal del WordPress viejo (o `WP_SOURCE_URL`).

Las direcciones del sitio viejo redirigen solas (301): `/shop/.../apple-fritter/` → `/product/apple-fritter`, `/product-category/pre-rolls/` → `/shop/pre-rolls`, `/effects/indica/` → `/shop?strain=Indica`, `/<articulo>/` → `/blog/<articulo>`, y `/sitemap.xml` se genera solo.

### Variables opcionales

| Variable | Para qué |
| --- | --- |
| `PUBLIC_URL` | Dirección pública (correos, sitemap, canonical). En Railway se detecta sola. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | Guardar imágenes y PDF en Cloudflare R2 (recomendado). Sin ellas van a la base de datos. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Correos de pedido y avisos de formularios. |
| `WP_SOURCE_URL` | Sitio viejo para el importador (por defecto `https://pottedusa.com`). |
| `SEED_DEMO` | `false` antes del primer arranque para empezar sin productos. |

## Cómo funciona

- **PayPal:** el cliente hace el pedido y en la página del pedido paga con los botones de PayPal. El servidor crea y captura el cobro y verifica el monto; si coincide, el pedido pasa a *Pago confirmado* y se envía el correo. Los pedidos con PayPal que no se pagan en 2 horas se cancelan solos y el inventario vuelve (antes se consulta a PayPal por si el pago sí entró).
- **Zelle u otros manuales:** en **Pagos** activa Zelle y escribe tus datos; el cliente sube el comprobante y tú confirmas el pago en el pedido.
- **Estados sin envío:** en **Ajustes → Venta y cumplimiento** (por defecto HI, ID, MN, OR, RI, UT, VT). El checkout no deja elegirlos y el servidor lo vuelve a validar.
- **Lab results:** cada reporte puede enlazarse a un producto y aparece también en su ficha.
- **Productos:** tipo/efecto (filtro de la tienda), peso y línea de potencia del COA. Las "presentaciones" son opcionales (ej. 1g, 3.5g) y cada una tiene su inventario.
- **Precios** en centavos, moneda USD.

## Desarrollo local

```
npm install
cp .env.example .env
npm run dev
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run check` | Revisa los tipos |
| `npm run build` | Compila en `dist/` |
| `npm start` | Arranca la versión compilada |
| `npm run db:generate` | Genera una migración después de cambiar `drizzle/schema.ts` |
