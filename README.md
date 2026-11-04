# Artesanales — Catálogo

Catálogo de **Artesanales · Sabores de tradición** (quesos de cabra y fiambres artesanales,
Güemes 1253, San Salvador de Jujuy) con pedido por WhatsApp y panel de administrador.

- `index.html`: el catálogo público, con buscador y filtros por categoría. El cliente arma
  el pedido, elige si lo retira en el local o se lo llevan, la forma de pago, y lo envía
  por WhatsApp al `388 4683996`.
- `admin.html`: el panel. Se entra desde el candado chiquito al final del pie. Permite
  agregar, editar y borrar productos, marcarlos sin stock, poner precio promo y elegir el
  orden en que se ven.
- `guia.html`: un video con voz que explica, paso a paso, cómo usar el catálogo y el panel
  (`guia/como-usar-el-catalogo.mp4`), con un resumen escrito abajo. Es para pasarle al cliente.
- `data/productos.json`: la lista de productos. **No hay base de datos**: el panel cambia
  este archivo haciendo un commit en este repositorio y GitHub Pages vuelve a publicar.

Está hecho en HTML, CSS y JavaScript sin compilar (Bootstrap 5 y SortableJS por CDN), igual
que el catálogo de PediloYa. El pie sigue el diseño del de Las Palmeras Club.

Cómo publicarlo y cómo darle la clave del panel al cliente: ver [DESPLIEGUE.md](DESPLIEGUE.md).

## Diseño

La paleta sale del logo:

| Uso | Color |
| --- | --- |
| Fondo (el mismo del logo) | `#FFF1DA` crema |
| Texto | `#2B1D14` marrón tinta, la letra del logo |
| Botones y precios | `#9B3A2E` rojo salame |
| Adornos | `#C28E3B` dorado de las espigas |
| Etiqueta de promo | `#E0892F` miel |

Tipografías: *Dancing Script* para los títulos (como la letra del logo) y *Montserrat* para
el texto (como "Sabores de tradición"). Las variables están al principio de `css/style.css`.

## Probar en tu PC

```bash
python3 -m http.server 5500
```

y abrí `http://localhost:5500`. Para el panel, `http://localhost:5500/admin.html` →
*Probar el panel sin guardar cambios*.
