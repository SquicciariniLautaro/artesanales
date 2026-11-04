// Todo lo que el panel le pide a GitHub. Solo lo carga admin.html.
//
// No hay base de datos: los productos están en data/productos.json y las
// fotos en img/productos/, dentro de este repositorio. Cada cambio del panel
// es un commit hecho con la API de GitHub; GitHub Pages vuelve a publicar el
// sitio solo, en uno o dos minutos.
//
// La "clave de acceso" es un token de GitHub con permiso para escribir solo en
// este repositorio (ver DESPLIEGUE.md). Sin ese token nadie puede cambiar
// nada, aunque entre a admin.html. El token no va en el código: lo escribe
// el dueño al ingresar y queda guardado en su navegador.

const API_GITHUB = 'https://api.github.com';
const CLAVE_TOKEN = 'artesanales-clave-panel';
const SIN_CONEXION = 'No hay conexión. Revisá la señal y probá de nuevo.';

let tokenGithub = null;
let shaProductos = null;      // versión de productos.json que se leyó por última vez
let alVencer = () => {};

function leerToken() {
    try {
        return sessionStorage.getItem(CLAVE_TOKEN) || localStorage.getItem(CLAVE_TOKEN);
    } catch (e) {
        return null;
    }
}

function guardarToken(token, recordar) {
    try {
        sessionStorage.setItem(CLAVE_TOKEN, token);
        if (recordar) localStorage.setItem(CLAVE_TOKEN, token);
    } catch (e) {}
}

function borrarToken() {
    try {
        sessionStorage.removeItem(CLAVE_TOKEN);
        localStorage.removeItem(CLAVE_TOKEN);
    } catch (e) {}
}

function urlContenido(ruta) {
    const camino = ruta.split('/').map(encodeURIComponent).join('/');
    return API_GITHUB + '/repos/' + REPO.usuario + '/' + REPO.nombre + '/contents/' + camino;
}

// --- Base64 (la API de GitHub manda y recibe los archivos así) -------------

function bytesABase64(bytes) {
    let binario = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binario);
}

function textoABase64(texto) {
    return bytesABase64(new TextEncoder().encode(texto));
}

function base64ATexto(base64) {
    const binario = atob(base64.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binario, c => c.charCodeAt(0)));
}

// --- Pedidos a GitHub --------------------------------------------------------

// Hace el pedido y devuelve el JSON, o tira un error ya explicado.
async function pedirAGithub(url, opciones = {}) {
    let res;
    try {
        res = await fetch(url, {
            ...opciones,
            // Sin caché: si no, se puede leer una versión vieja y el guardado falla.
            cache: 'no-store',
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: 'Bearer ' + tokenGithub,
                'X-GitHub-Api-Version': '2022-11-28',
                ...(opciones.body ? { 'Content-Type': 'application/json' } : {})
            }
        });
    } catch (err) {
        throw new Error(SIN_CONEXION);
    }
    if (res.ok) return res.status === 204 ? null : res.json();

    const error = new Error(explicarError(res));
    error.estado = res.status;
    if (res.status === 401) {
        borrarToken();
        alVencer();
    }
    throw error;
}

function explicarError(res) {
    if (res.status === 401) return 'La clave no es válida o se venció. Volvé a ingresar.';
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
        return 'Se hicieron demasiados cambios seguidos. Esperá unos minutos y probá de nuevo.';
    }
    if (res.status === 403) return 'La clave no tiene permiso para guardar cambios en el catálogo.';
    if (res.status === 404) return 'No se encontró el catálogo. Revisá que la clave sea de este sitio.';
    if (res.status === 409 || res.status === 422) {
        return 'Los productos cambiaron desde otro lado mientras editabas. Recargá la página y probá de nuevo.';
    }
    return 'Algo falló (' + res.status + '). Probá de nuevo.';
}

// Los guardados van de a uno y en fila: cada commit necesita la versión que
// dejó el anterior.
let colaGithub = Promise.resolve();
function enFila(tarea) {
    const resultado = colaGithub.then(tarea);
    colaGithub = resultado.catch(() => {});
    return resultado;
}

function nombreParaArchivo(texto) {
    const base = (texto || 'producto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return (base || 'producto') + '-' + Date.now().toString(36);
}

const apiGithub = {
    // Devuelve un texto para mostrar si hay una clave guardada que funciona; si no, null.
    async verSesion() {
        tokenGithub = leerToken();
        if (!tokenGithub) return null;
        try {
            return await this.comprobarClave();
        } catch (err) {
            if (err.estado === 401 || err.estado === 403 || err.estado === 404) {
                borrarToken();
                return null;
            }
            throw err;
        }
    },

    async iniciarSesion(clave, recordar) {
        tokenGithub = clave.trim();
        if (!tokenGithub) throw new Error('Escribí la clave de acceso.');
        await this.comprobarClave();
        guardarToken(tokenGithub, recordar);
        return REPO.nombre;
    },

    // Que la clave abra este repositorio y pueda escribir en él.
    async comprobarClave() {
        const repo = await pedirAGithub(API_GITHUB + '/repos/' + REPO.usuario + '/' + REPO.nombre);
        if (repo.permissions && repo.permissions.push === false) {
            throw new Error('La clave no tiene permiso para guardar cambios en el catálogo.');
        }
        return repo.full_name;
    },

    async cerrarSesion() {
        borrarToken();
        tokenGithub = null;
    },

    // Avisa cuando la clave dejó de funcionar, para volver al formulario de ingreso.
    alVencerSesion(funcion) {
        alVencer = funcion;
    },

    async listarProductos() {
        return enFila(async () => {
            const archivo = await pedirAGithub(urlContenido(REPO.archivoProductos) + '?ref=' + encodeURIComponent(REPO.rama));
            shaProductos = archivo.sha;
            return JSON.parse(base64ATexto(archivo.content));
        });
    },

    // Guarda la lista entera, en el orden en que se tiene que ver.
    async guardarLista(lista, mensaje) {
        return enFila(async () => {
            const respuesta = await pedirAGithub(urlContenido(REPO.archivoProductos), {
                method: 'PUT',
                body: JSON.stringify({
                    message: 'Panel: ' + mensaje,
                    content: textoABase64(JSON.stringify(lista, null, 2) + '\n'),
                    sha: shaProductos,
                    branch: REPO.rama
                })
            });
            shaProductos = respuesta.content.sha;
        });
    },

    // Sube una foto ya achicada y devuelve su ruta dentro del sitio.
    async subirImagen(blob, nombreProducto) {
        const ruta = REPO.carpetaFotos + '/' + nombreParaArchivo(nombreProducto) + '.jpg';
        const contenido = bytesABase64(new Uint8Array(await blob.arrayBuffer()));
        return enFila(async () => {
            await pedirAGithub(urlContenido(ruta), {
                method: 'PUT',
                body: JSON.stringify({ message: 'Panel: foto de ' + nombreProducto, content: contenido, branch: REPO.rama })
            });
            return ruta;
        });
    },

    // Borra una foto que ya no usa ningún producto. Si falla no se avisa:
    // queda una foto suelta en el repositorio, nada que el dueño tenga que resolver.
    async borrarImagen(ruta) {
        if (!ruta || !ruta.startsWith(REPO.carpetaFotos + '/')) return;
        return enFila(async () => {
            const archivo = await pedirAGithub(urlContenido(ruta) + '?ref=' + encodeURIComponent(REPO.rama));
            await pedirAGithub(urlContenido(ruta), {
                method: 'DELETE',
                body: JSON.stringify({ message: 'Panel: borrar foto que no se usa', sha: archivo.sha, branch: REPO.rama })
            });
        });
    }
};

const apiAdmin = modoPruebaActivo() ? apiPrueba : apiGithub;
