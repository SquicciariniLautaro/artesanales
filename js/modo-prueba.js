// Base de mentira para el modo prueba (ver modoPruebaActivo en api.js): hace
// lo mismo que api-admin.js pero guarda los productos en este navegador, sin
// tocar el sitio publicado. Arranca con los productos reales.
// Sirve para probar el panel o mostrárselo al cliente sin riesgo.

const apiPrueba = {
    async verSesion() {
        return modoPruebaActivo() ? 'modo prueba' : null;
    },

    async iniciarSesion() {
        localStorage.setItem(MARCA_MODO_PRUEBA, '1');
        return 'modo prueba';
    },

    async cerrarSesion() {
        salirDelModoPrueba();
    },

    alVencerSesion() {},

    async listarProductos() {
        const guardados = localStorage.getItem(CLAVE_PRUEBA);
        if (guardados) return JSON.parse(guardados);
        const iniciales = await leerArchivoProductos();
        localStorage.setItem(CLAVE_PRUEBA, JSON.stringify(iniciales));
        return iniciales;
    },

    async guardarLista(lista) {
        try {
            localStorage.setItem(CLAVE_PRUEBA, JSON.stringify(lista));
        } catch (e) {
            throw new Error('El navegador se quedó sin lugar para el modo prueba. Probá con fotos más chicas o salí del modo prueba.');
        }
    },

    // La "foto subida" queda como texto dentro del mismo producto.
    subirImagen(blob) {
        return new Promise((resolve, reject) => {
            const lector = new FileReader();
            lector.onload = () => resolve(lector.result);
            lector.onerror = () => reject(new Error('No se pudo leer la foto.'));
            lector.readAsDataURL(blob);
        });
    },

    async borrarImagen() {}
};
