// Lo que el catálogo necesita leer: la lista de productos.
// Sale de data/productos.json, el mismo archivo que cambia el panel.

// Modo prueba: el panel puede guardar los productos solo en este navegador
// para probarlo sin tocar el sitio publicado (ver modo-prueba.js). Mientras
// esté prendido, el catálogo de este navegador muestra esa lista.
const CLAVE_PRUEBA = 'artesanales-productos-prueba';
const MARCA_MODO_PRUEBA = 'artesanales-modo-prueba';

function modoPruebaActivo() {
    try {
        return localStorage.getItem(MARCA_MODO_PRUEBA) === '1';
    } catch (e) {
        return false;
    }
}

function salirDelModoPrueba() {
    try {
        localStorage.removeItem(MARCA_MODO_PRUEBA);
        localStorage.removeItem(CLAVE_PRUEBA);
    } catch (e) {}
}

// Devuelve los productos ya en el orden en que se muestran:
// { id, nombre, descripcion, categoria, precio, precio_promo, unidad, imagen_url, disponible }
async function obtenerProductos() {
    if (modoPruebaActivo()) {
        try {
            const guardados = localStorage.getItem(CLAVE_PRUEBA);
            if (guardados) return JSON.parse(guardados);
        } catch (e) {}
    }
    return leerArchivoProductos();
}

async function leerArchivoProductos() {
    // no-cache: el navegador pregunta siempre si cambió, así un producto
    // recién cargado desde el panel aparece sin tener que borrar nada.
    const res = await fetch(REPO.archivoProductos, { cache: 'no-cache' });
    if (!res.ok) throw new Error('No se pudo leer la lista de productos (' + res.status + ')');
    const lista = await res.json();
    if (!Array.isArray(lista)) throw new Error('La lista de productos no tiene el formato esperado');
    return lista;
}
