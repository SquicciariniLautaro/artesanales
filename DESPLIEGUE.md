# Puesta en marcha

Cómo queda repartido:

| Pieza | Dónde vive |
| --- | --- |
| Catálogo (`index.html`) y panel (`admin.html`) | GitHub Pages: `https://squicciarinilautaro.github.io/artesanales/` |
| Productos | `data/productos.json`, en este repositorio |
| Fotos de los productos | `img/productos/`, en este repositorio |

No hay base de datos ni servidor propio. El panel habla directo con la API de GitHub: cada
cambio que se guarda es un commit en la rama `main`, y GitHub Pages vuelve a publicar el
sitio solo en uno o dos minutos.

---

## Paso 1 - Publicar con GitHub Pages

1. Juntar esta rama en `main`.
2. En el repositorio: `Settings` → `Pages`.
3. *Source*: `Deploy from a branch`. *Branch*: `main` y carpeta `/ (root)`. `Save`.
4. Esperar un par de minutos: arriba de esa misma página aparece la dirección del sitio.

El archivo `.nojekyll` hace que GitHub publique los archivos tal cual, sin procesarlos.

Si el sitio se publica en otra dirección (un dominio propio o Vercel), hay que cambiar las
direcciones `og:url` y `og:image` del `<head>` de `index.html`: son las que usan WhatsApp e
Instagram para armar la vista previa del link.

## Paso 2 - Crear la clave del panel

La "clave de acceso" del panel es un token de GitHub que **solo** puede cambiar archivos de
este repositorio. Se crea una vez, con la cuenta dueña del repositorio:

1. GitHub → foto de perfil → `Settings` → `Developer settings` → `Personal access tokens` →
   `Fine-grained tokens` → `Generate new token`.
2. *Token name*: `Panel Artesanales`.
3. *Expiration*: la más larga que ofrezca (o `No expiration`). Cuando vence, el panel avisa
   que la clave no es válida y hay que generar otra.
4. *Repository access*: `Only select repositories` → `artesanales`.
5. *Permissions* → *Repository permissions* → **Contents: Read and write**. Nada más.
6. `Generate token` y copiarlo (empieza con `github_pat_`). GitHub lo muestra una sola vez.

Esa clave se le pasa al cliente por un canal privado. **No va en el código ni en ningún
archivo del repositorio**: este repositorio es público y cualquiera podría usarla.

Si la clave se filtra: en la misma página de tokens se borra (`Delete`) y se genera otra.
Deja de funcionar en el acto.

## Paso 3 - Comprobaciones

- [ ] El catálogo muestra los productos, con fotos y precios.
- [ ] El candado chiquito del pie lleva a `admin.html` y deja entrar con la clave.
- [ ] Agregar un producto con foto, editarlo, moverlo de lugar y borrarlo; un par de minutos
      después de cada cambio, recargar el catálogo y ver que se refleja.
- [ ] Marcar un producto sin stock: en el catálogo aparece gris y no se puede pedir.
- [ ] Armar un pedido y mandarlo: tiene que abrir WhatsApp con el pedido escrito.
- [ ] Lo mismo desde un celular.

---

## Cómo se usa el panel

- **Orden**: la lista del panel está en el mismo orden que el catálogo. Se cambia
  arrastrando un producto desde `⠿` o con las flechas `↑` `↓`. Se guarda solo.
- **Agregar**: el producto nuevo entra al final de la lista; después se lo sube adonde haga
  falta.
- **Fotos**: se eligen desde el celular o la PC. El panel las achica antes de subirlas
  (900 px de lado máximo), así que no hace falta prepararlas.
- **Se vende por**: lo que se muestra al lado del precio (`/ 1/4 kg`, `/ horma`, `/ unidad`).
  El cliente pide cantidades de eso: "2 x Salame (1/4 kg)".
- **Promo**: si se completa *Precio promo*, el catálogo muestra el precio tachado, el de
  promo y la etiqueta *¡Promo!*, y aparece el filtro *Promos*.
- **Categorías**: están en `CATEGORIAS`, en `js/config.js`. En el catálogo solo se ven los
  filtros de las categorías que tienen productos.
- **Los cambios tardan uno o dos minutos** en verse en el catálogo publicado: es lo que
  tarda GitHub Pages en volver a publicar.
- **Modo prueba**: desde la pantalla de ingreso, *Probar el panel sin guardar cambios*. Lo
  que se cambie queda solo en ese navegador (y el catálogo de ese navegador lo muestra, con
  un aviso arriba) hasta tocar *Salir*. Sirve para mostrarle el panel al cliente sin riesgo.

## Datos del negocio

Están en `js/config.js`:

- `NEGOCIO.whatsapp`: el número que recibe los pedidos, con código de país y sin `+` ni
  espacios.
- `NEGOCIO.formasDePago` y `NEGOCIO.formasDeEntrega`: las opciones que ve el cliente al
  armar el pedido. Si figura `Efectivo`, el formulario pregunta además con cuánto paga. Si
  elige la segunda forma de entrega (envío), se le pide la dirección.
- `HORARIOS`: para el cartel "Abierto ahora" / "Cerrado · abre mañana a las 8 hs".
- `REPO`: el repositorio y la rama donde el panel guarda los cambios. Si el repositorio se
  renombra o se publica desde otra rama, hay que cambiarlo acá.

## Más adelante: pasar a una base de datos

Toda la lectura y escritura de productos está en dos archivos: `js/api.js` (lo que lee el
catálogo) y `js/api-admin.js` (lo que hace el panel). Para pasar a Supabase como en
PediloYa alcanza con reemplazar esos dos; el resto del sitio no cambia.
