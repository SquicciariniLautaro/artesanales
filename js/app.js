// Catálogo público: productos, buscador, filtros, pedido y envío por WhatsApp.

let productos = [];
// El pedido guarda solo qué producto y cuántos. El nombre y el precio se leen
// siempre de "productos": así nunca queda un precio viejo guardado.
let carrito = [];               // [{ id, cantidad }]
let categoriaActiva = 'Todos';
let textoBuscado = '';
let ubicacion = null;           // { latitud, longitud, precision } si el cliente la sumó al pedido

// Zona de botones de cada tarjeta en pantalla (id del producto -> elemento),
// para poder redibujar solo esa parte cuando cambia la cantidad.
let zonasDeAccion = new Map();

const CLAVE_CARRITO = 'artesanales-carrito';
const CLAVE_ENTREGA = 'artesanales-entrega';
const TARJETAS_DE_CARGA = 6;
const ENVIO = NEGOCIO.formasDeEntrega[1];
// Metros. Más allá de esto el link puede caer a una o dos cuadras: se avisa en el pedido.
const PRECISION_ACEPTABLE = 100;
const PLAN_B_UBICACION = 'Si no anda, mandá el pedido igual y después compartí tu ubicación en el chat de WhatsApp (clip → Ubicación).';
const NOMBRES_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('pie-whatsapp').href = 'https://wa.me/' + NEGOCIO.whatsapp;
    document.getElementById('pie-instagram').href = NEGOCIO.instagram;
    document.getElementById('pie-mapa').href = NEGOCIO.mapa;
    document.getElementById('portada-mapa').href = NEGOCIO.mapa;
    document.getElementById('pie-anio').textContent = new Date().getFullYear();

    if (modoPruebaActivo()) {
        mostrar('aviso-prueba', true);
        document.getElementById('btn-salir-prueba').addEventListener('click', () => {
            salirDelModoPrueba();
            location.reload();
        });
    }

    mostrarEstadoDelLocal();

    const buscador = document.getElementById('buscador');
    buscador.addEventListener('input', () => {
        textoBuscado = buscador.value;
        renderizarCatalogo();
    });
    // En el celular, "Buscar" en el teclado lo cierra para ver los resultados.
    buscador.addEventListener('keydown', evento => {
        if (evento.key === 'Enter') buscador.blur();
    });

    document.getElementById('filtros').addEventListener('click', evento => {
        const boton = evento.target.closest('.btn-filtro');
        if (boton) filtrar(boton.dataset.categoria);
    });
    document.getElementById('btn-limpiar-busqueda').addEventListener('click', limpiarBusqueda);
    document.getElementById('btn-reintentar').addEventListener('click', cargarProductos);
    document.getElementById('btn-vaciar').addEventListener('click', vaciarPedido);
    document.getElementById('btn-ubicacion').addEventListener('click', alternarUbicacion);
    document.getElementById('form-entrega').addEventListener('submit', enviarPedidoWhatsApp);

    prepararFormularioEntrega();
    cargarProductos();
});

// --- Utilidades -------------------------------------------------------------

function mostrar(id, visible) {
    document.getElementById(id).classList.toggle('d-none', !visible);
}

function formatearPrecio(numero) {
    return '$' + Number(numero).toLocaleString('es-AR');
}

function precioDe(prod) {
    return prod.precio_promo ? prod.precio_promo : prod.precio;
}

function buscarProducto(id) {
    return productos.find(p => p.id === id);
}

// localStorage puede no estar disponible (modo privado, espacio lleno): el
// sitio tiene que funcionar igual, solo que sin recordar.
function leerGuardado(clave, porDefecto) {
    try {
        const texto = localStorage.getItem(clave);
        return texto ? JSON.parse(texto) : porDefecto;
    } catch (e) {
        return porDefecto;
    }
}

function guardar(clave, valor) {
    try {
        localStorage.setItem(clave, JSON.stringify(valor));
    } catch (e) {}
}

// Vuelve a dibujar un pedazo de la página sin que quien usa el teclado pierda
// el lugar: si el foco estaba en un botón de adentro, vuelve al equivalente.
function redibujarConFoco(contenedor, redibujar) {
    const activo = contenedor.contains(document.activeElement) ? document.activeElement : null;
    const marca = activo ? { id: activo.dataset.id, accion: activo.dataset.accion } : null;
    redibujar();
    if (!marca) return;
    const botones = [...contenedor.querySelectorAll('button[data-accion]')];
    const equivalente = botones.find(b => b.dataset.id === marca.id && b.dataset.accion === marca.accion)
        || botones.find(b => b.dataset.id === marca.id)
        || botones[0];
    if (equivalente) equivalente.focus();
}

// --- Horario ----------------------------------------------------------------

// Día y hora actuales en Jujuy, sin importar la zona horaria del celular.
function ahoraEnElLocal() {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: HORARIOS.zona, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
    }).formatToParts(new Date());
    const valor = tipo => partes.find(p => p.type === tipo).value;
    const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(valor('weekday'));
    return { dia: dia, hora: Number(valor('hour')) + Number(valor('minute')) / 60 };
}

// "Abierto · hasta las 17 hs" o "Cerrado · abre el lunes a las 8 hs".
function mostrarEstadoDelLocal() {
    let ahora;
    try {
        ahora = ahoraEnElLocal();
    } catch (e) {
        return; // navegador muy viejo: queda el horario escrito en el HTML
    }
    const estado = document.getElementById('estado-local');
    const texto = document.getElementById('estado-texto');
    const hoy = HORARIOS.dias[ahora.dia];

    if (hoy && ahora.hora >= hoy[0] && ahora.hora < hoy[1]) {
        estado.classList.add('abierto');
        texto.textContent = 'Abierto ahora · hasta las ' + hoy[1] + ' hs';
        return;
    }

    estado.classList.add('cerrado');
    // Busca el próximo turno: hoy más tarde, o alguno de los días siguientes.
    for (let salto = 0; salto < 7; salto++) {
        const dia = (ahora.dia + salto) % 7;
        const turno = HORARIOS.dias[dia];
        if (!turno || (salto === 0 && ahora.hora >= turno[0])) continue;
        const cuando = salto === 0 ? 'hoy' : salto === 1 ? 'mañana' : 'el ' + NOMBRES_DIAS[dia];
        texto.textContent = 'Cerrado · abre ' + cuando + ' a las ' + turno[0] + ' hs';
        return;
    }
    texto.textContent = 'Cerrado';
}

// --- Catálogo ---------------------------------------------------------------

function cargarProductos() {
    mostrar('error-carga', false);
    mostrar('sin-resultados', false);
    mostrarTarjetasDeCarga();

    // Los productos llegan ya en el orden en que se muestran (ver api.js).
    obtenerProductos()
        .then(lista => {
            productos = lista;
            // Del pedido guardado quedan los productos que siguen existiendo y con stock.
            const guardado = leerGuardado(CLAVE_CARRITO, []);
            carrito = (Array.isArray(guardado) ? guardado : []).filter(item => {
                const prod = buscarProducto(item.id);
                return prod && prod.disponible && item.cantidad > 0;
            });
            dibujarFiltros();
            renderizarCatalogo();
            actualizarCarrito();
        })
        .catch(err => {
            console.error('Error al cargar datos:', err);
            document.getElementById('catalogo-container').innerHTML = '';
            mostrar('error-carga', true);
        });
}

// Tarjetas con la forma de un producto, mientras llegan los datos.
function mostrarTarjetasDeCarga() {
    const contenedor = document.getElementById('catalogo-container');
    contenedor.innerHTML = '';
    for (let i = 0; i < TARJETAS_DE_CARGA; i++) {
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-xl-3';
        col.setAttribute('aria-hidden', 'true');
        const card = document.createElement('div');
        card.className = 'card-producto tarjeta-cargando';
        ['img-container', 'linea', 'linea linea-corta', 'linea linea-boton'].forEach(clases => {
            const bloque = document.createElement('div');
            bloque.className = clases;
            card.appendChild(bloque);
        });
        col.appendChild(card);
        contenedor.appendChild(col);
    }
}

// Un botón por categoría que tenga productos, en el orden de config.js.
// "Promos" aparece solo si hay alguno con precio promo.
function dibujarFiltros() {
    const usadas = new Set(productos.map(p => p.categoria));
    const categorias = CATEGORIAS.filter(c => usadas.has(c));
    // Por si se cargó una categoría que no está en la lista de config.js.
    usadas.forEach(c => { if (!categorias.includes(c)) categorias.push(c); });
    const nombres = ['Todos'];
    if (productos.some(p => p.precio_promo)) nombres.push('Promos');
    nombres.push(...categorias);

    if (!nombres.includes(categoriaActiva)) categoriaActiva = 'Todos';

    const contenedor = document.getElementById('filtros');
    contenedor.innerHTML = '';
    nombres.forEach(nombre => {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'btn-filtro';
        boton.dataset.categoria = nombre;
        boton.textContent = nombre;
        const activo = nombre === categoriaActiva;
        boton.classList.toggle('active', activo);
        boton.setAttribute('aria-pressed', activo);
        contenedor.appendChild(boton);
    });
    // Con una sola categoría los filtros no aportan nada.
    document.querySelector('.filtros-barra').classList.toggle('d-none', nombres.length <= 2);
}

function normalizar(texto) {
    // Minúsculas y sin tildes: "jamon" encuentra "Jamón".
    return (texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function productosVisibles() {
    const palabras = normalizar(textoBuscado).split(/\s+/).filter(Boolean);
    return productos.filter(prod => {
        if (categoriaActiva === 'Promos') {
            if (!prod.precio_promo) return false;
        } else if (categoriaActiva !== 'Todos' && prod.categoria !== categoriaActiva) {
            return false;
        }
        const dondeBuscar = normalizar(prod.nombre + ' ' + prod.categoria + ' ' + (prod.descripcion || ''));
        return palabras.every(palabra => dondeBuscar.includes(palabra));
    });
}

function renderizarCatalogo() {
    const contenedor = document.getElementById('catalogo-container');
    const lista = productosVisibles();
    contenedor.innerHTML = '';
    zonasDeAccion = new Map();
    lista.forEach(prod => contenedor.appendChild(crearTarjeta(prod)));

    const filtrando = textoBuscado.trim() !== '' || categoriaActiva !== 'Todos';
    mostrar('sin-resultados', lista.length === 0);
    if (lista.length === 0) {
        const buscado = textoBuscado.trim();
        document.getElementById('sin-resultados-texto').textContent = buscado
            ? 'No hay productos que coincidan con “' + buscado + '”' + (categoriaActiva === 'Todos' ? '.' : ' en esta categoría.')
            : (categoriaActiva === 'Promos' ? 'Por ahora no hay promos.' : 'Todavía no hay productos cargados.');
    }
    document.getElementById('resultado-busqueda').textContent = filtrando
        ? (lista.length === 1 ? '1 producto' : lista.length + ' productos')
        : '';
}

function crearTarjeta(prod) {
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-xl-3';

    const card = document.createElement('article');
    card.className = 'card-producto h-100 d-flex flex-column';
    if (!prod.disponible) card.classList.add('sin-stock');

    const imgContainer = document.createElement('div');
    imgContainer.className = 'img-container';

    if (!prod.disponible) {
        const agotado = document.createElement('span');
        agotado.className = 'etiqueta etiqueta-sin-stock';
        agotado.textContent = 'Sin stock';
        imgContainer.appendChild(agotado);
    } else if (prod.precio_promo) {
        const promo = document.createElement('span');
        promo.className = 'etiqueta';
        promo.textContent = '¡Promo!';
        imgContainer.appendChild(promo);
    }

    const sinImagen = document.createElement('span');
    sinImagen.className = 'sin-imagen';
    sinImagen.textContent = 'Sin foto';

    if (prod.imagen_url) {
        const img = document.createElement('img');
        img.src = prod.imagen_url;
        // El nombre está escrito justo debajo: repetirlo acá sería ruido para un lector de pantalla.
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = 600;
        img.height = 600;
        img.onerror = () => img.replaceWith(sinImagen);
        imgContainer.appendChild(img);
    } else {
        imgContainer.appendChild(sinImagen);
    }

    const body = document.createElement('div');
    body.className = 'tarjeta-cuerpo d-flex flex-column flex-grow-1';

    const title = document.createElement('h2');
    title.className = 'tarjeta-nombre';
    title.textContent = prod.nombre;
    body.appendChild(title);

    if (prod.descripcion) {
        const descripcion = document.createElement('p');
        descripcion.className = 'tarjeta-descripcion';
        descripcion.textContent = prod.descripcion;
        body.appendChild(descripcion);
    }

    const precios = document.createElement('p');
    precios.className = 'tarjeta-precios mt-auto';
    if (prod.precio_promo) {
        const tachado = document.createElement('s');
        tachado.className = 'precio-tachado';
        tachado.textContent = formatearPrecio(prod.precio);
        precios.appendChild(tachado);
    }
    const precioTxt = document.createElement('span');
    precioTxt.className = 'precio';
    precioTxt.textContent = formatearPrecio(precioDe(prod));
    precios.appendChild(precioTxt);
    if (prod.unidad) {
        const unidad = document.createElement('span');
        unidad.className = 'precio-unidad';
        unidad.textContent = '/ ' + prod.unidad;
        precios.appendChild(unidad);
    }
    body.appendChild(precios);

    const zona = document.createElement('div');
    zona.className = 'tarjeta-accion';
    zonasDeAccion.set(prod.id, zona);
    body.appendChild(zona);
    dibujarAccion(prod);

    card.appendChild(imgContainer);
    card.appendChild(body);
    col.appendChild(card);
    return col;
}

// Los botones de una tarjeta: "Agregar", o el contador si ya está en el pedido.
function dibujarAccion(prod) {
    const zona = zonasDeAccion.get(prod.id);
    if (!zona) return; // la tarjeta no está en pantalla (quedó fuera del filtro)

    redibujarConFoco(zona, () => {
        zona.innerHTML = '';
        const cantidad = cantidadEnPedido(prod.id);

        if (!prod.disponible) {
            const btnAgotado = document.createElement('button');
            btnAgotado.type = 'button';
            btnAgotado.className = 'btn btn-outline-secondary w-100';
            btnAgotado.textContent = 'Sin stock';
            btnAgotado.disabled = true;
            zona.appendChild(btnAgotado);
        } else if (cantidad > 0) {
            zona.appendChild(crearControlCantidad(prod, cantidad));
        } else {
            const btnAgregar = crearBotonCantidad(prod, 'sumar', 'Agregar', 'Agregar ' + prod.nombre + ' al pedido');
            btnAgregar.className = 'btn btn-salame w-100';
            zona.appendChild(btnAgregar);
        }
    });
}

function crearBotonCantidad(prod, accion, texto, etiqueta) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = texto;
    boton.dataset.id = prod.id;
    boton.dataset.accion = accion;
    boton.setAttribute('aria-label', etiqueta);
    boton.onclick = () => cambiarCantidad(prod.id, accion === 'sumar' ? 1 : -1);
    return boton;
}

// El contador  − 2 +  que se usa en la tarjeta y en el pedido.
function crearControlCantidad(prod, cantidad) {
    const control = document.createElement('div');
    control.className = 'control-cantidad';

    const btnRestar = crearBotonCantidad(prod, 'restar', '−', 'Quitar uno de ' + prod.nombre);
    const btnSumar = crearBotonCantidad(prod, 'sumar', '+', 'Agregar otro de ' + prod.nombre);

    const numero = document.createElement('span');
    numero.className = 'control-numero';
    numero.textContent = cantidad;
    numero.setAttribute('aria-label', cantidad + ' en el pedido');

    control.appendChild(btnRestar);
    control.appendChild(numero);
    control.appendChild(btnSumar);
    return control;
}

function filtrar(categoria) {
    categoriaActiva = categoria;
    document.querySelectorAll('#filtros .btn-filtro').forEach(btn => {
        const activo = btn.dataset.categoria === categoria;
        btn.classList.toggle('active', activo);
        btn.setAttribute('aria-pressed', activo);
    });
    renderizarCatalogo();

    // Si se cambió de categoría estando abajo en la página, vuelve al principio de la lista.
    const catalogo = document.getElementById('catalogo');
    if (catalogo.getBoundingClientRect().top < 0) catalogo.scrollIntoView();
}

function limpiarBusqueda() {
    textoBuscado = '';
    document.getElementById('buscador').value = '';
    filtrar('Todos');
}

// --- Pedido -----------------------------------------------------------------

function cantidadEnPedido(id) {
    const item = carrito.find(i => i.id === id);
    return item ? item.cantidad : 0;
}

function cambiarCantidad(id, pasos) {
    const prod = buscarProducto(id);
    if (!prod || !prod.disponible) return;

    const item = carrito.find(i => i.id === id);
    if (item) item.cantidad += pasos;
    else if (pasos > 0) carrito.push({ id: id, cantidad: pasos });
    carrito = carrito.filter(i => i.cantidad > 0);

    guardar(CLAVE_CARRITO, carrito);
    dibujarAccion(prod);
    actualizarCarrito();
}

function eliminarDelCarrito(id) {
    cambiarCantidad(id, -cantidadEnPedido(id));
}

function vaciarPedido() {
    const quitados = carrito.map(item => buscarProducto(item.id));
    carrito = [];
    guardar(CLAVE_CARRITO, carrito);
    quitados.forEach(dibujarAccion);
    actualizarCarrito();
}

function totalDelPedido() {
    return carrito.reduce((suma, item) => suma + precioDe(buscarProducto(item.id)) * item.cantidad, 0);
}

function actualizarCarrito() {
    const lista = document.getElementById('carrito-items');
    const teniaFoco = lista.contains(document.activeElement);
    let cantidadTotalArticulos = 0;

    redibujarConFoco(lista, () => {
        lista.innerHTML = '';
        carrito.forEach(item => {
            const prod = buscarProducto(item.id);
            cantidadTotalArticulos += item.cantidad;
            lista.appendChild(crearItemDelPedido(prod, item.cantidad));
        });
    });

    const total = formatearPrecio(totalDelPedido());
    document.getElementById('carrito-total').textContent = total;
    document.getElementById('barra-total').textContent = total;
    document.getElementById('cart-count').textContent = cantidadTotalArticulos;
    document.getElementById('barra-cantidad').textContent = cantidadTotalArticulos;

    const vacio = carrito.length === 0;
    mostrar('pedido-vacio', vacio);
    mostrar('pedido-lleno', !vacio);
    mostrar('barra-pedido', !vacio);
    // Se quitó el último producto desde el panel: el foco pasa a "Ver productos".
    if (vacio && teniaFoco) document.querySelector('#pedido-vacio button').focus();
}

function textoUnidad(prod) {
    return formatearPrecio(precioDe(prod)) + (prod.unidad ? ' / ' + prod.unidad : ' c/u');
}

function crearItemDelPedido(prod, cantidad) {
    const item = document.createElement('li');
    item.className = 'pedido-item';

    const foto = document.createElement('div');
    foto.className = 'pedido-foto';
    if (prod.imagen_url) {
        const img = document.createElement('img');
        img.src = prod.imagen_url;
        img.alt = '';
        img.onerror = () => img.remove();
        foto.appendChild(img);
    }

    const info = document.createElement('div');
    info.className = 'pedido-info';

    const nombre = document.createElement('p');
    nombre.className = 'pedido-nombre';
    nombre.textContent = prod.nombre;

    const unidad = document.createElement('p');
    unidad.className = 'pedido-unidad';
    unidad.textContent = textoUnidad(prod);

    const renglon = document.createElement('div');
    renglon.className = 'd-flex justify-content-between align-items-center';

    const subtotal = document.createElement('span');
    subtotal.className = 'precio';
    subtotal.textContent = formatearPrecio(precioDe(prod) * cantidad);

    renglon.appendChild(crearControlCantidad(prod, cantidad));
    renglon.appendChild(subtotal);

    info.appendChild(nombre);
    info.appendChild(unidad);
    info.appendChild(renglon);

    const btnQuitar = document.createElement('button');
    btnQuitar.type = 'button';
    btnQuitar.className = 'btn-close pedido-quitar';
    btnQuitar.dataset.id = prod.id;
    btnQuitar.dataset.accion = 'quitar';
    btnQuitar.setAttribute('aria-label', 'Quitar ' + prod.nombre + ' del pedido');
    btnQuitar.onclick = () => eliminarDelCarrito(prod.id);

    item.appendChild(foto);
    item.appendChild(info);
    item.appendChild(btnQuitar);
    return item;
}

// --- Datos del pedido -------------------------------------------------------

const CAMPOS_ENTREGA = ['entrega-nombre', 'entrega-direccion', 'entrega-indicaciones'];

function valorDe(id) {
    return document.getElementById(id).value.trim();
}

function opcionElegida(nombre) {
    const marcada = document.querySelector('input[name="' + nombre + '"]:checked');
    return marcada ? marcada.value : '';
}

function formaDePagoElegida() {
    return opcionElegida('entrega-pago');
}

function formaDeEntregaElegida() {
    return opcionElegida('entrega-forma');
}

// Botones de opción (uno solo marcado) a partir de una lista de config.js.
function dibujarOpciones(contenedorId, nombre, opciones, guardada) {
    const contenedor = document.getElementById(contenedorId);
    opciones.forEach((texto, posicion) => {
        const opcion = document.createElement('input');
        opcion.type = 'radio';
        opcion.className = 'btn-check';
        opcion.name = nombre;
        opcion.id = nombre + '-' + posicion;
        opcion.value = texto;
        opcion.checked = guardada ? guardada === texto : posicion === 0;

        const etiqueta = document.createElement('label');
        etiqueta.className = 'btn btn-outline-salame';
        etiqueta.htmlFor = opcion.id;
        etiqueta.textContent = texto;

        contenedor.appendChild(opcion);
        contenedor.appendChild(etiqueta);
    });
    // Por si la opción guardada ya no se ofrece.
    if (!opcionElegida(nombre) && contenedor.firstElementChild) contenedor.firstElementChild.checked = true;
    contenedor.addEventListener('change', () => {
        actualizarCamposSegunOpciones();
        guardarEntrega();
    });
}

// Completa el formulario con lo que el cliente puso la última vez, para que
// en el próximo pedido no tenga que escribir todo de nuevo.
function prepararFormularioEntrega() {
    const guardada = leerGuardado(CLAVE_ENTREGA, {});
    CAMPOS_ENTREGA.forEach(id => {
        const campo = document.getElementById(id);
        campo.value = guardada[id] || '';
        campo.addEventListener('input', () => {
            campo.classList.remove('is-invalid');
            guardarEntrega();
        });
    });

    dibujarOpciones('entrega-formas', 'entrega-forma', NEGOCIO.formasDeEntrega, guardada.forma);
    dibujarOpciones('entrega-pagos', 'entrega-pago', NEGOCIO.formasDePago, guardada.pago);

    document.getElementById('entrega-paga-con').addEventListener('input', evento => {
        evento.target.classList.remove('is-invalid');
    });
    actualizarCamposSegunOpciones();
}

// La dirección solo hace falta si se lo llevan; "¿Con cuánto pagás?" solo si paga en efectivo.
function actualizarCamposSegunOpciones() {
    const conEnvio = formaDeEntregaElegida() === ENVIO;
    mostrar('grupo-envio', conEnvio);
    mostrar('grupo-retiro', !conEnvio);
    mostrar('grupo-paga-con', formaDePagoElegida() === 'Efectivo');
}

function guardarEntrega() {
    const datos = { pago: formaDePagoElegida(), forma: formaDeEntregaElegida() };
    CAMPOS_ENTREGA.forEach(id => { datos[id] = valorDe(id); });
    guardar(CLAVE_ENTREGA, datos);
}

// Suma (o quita) la ubicación actual del cliente. Solo se usa para poner un
// link al mapa en el mensaje del pedido: no se guarda ni se manda a otro lado.
function alternarUbicacion() {
    const boton = document.getElementById('btn-ubicacion');
    const texto = document.getElementById('btn-ubicacion-texto');
    const estado = document.getElementById('ubicacion-estado');

    if (ubicacion) {
        ubicacion = null;
        texto.textContent = 'Sumar mi ubicación actual';
        estado.textContent = '';
        return;
    }
    if (!navigator.geolocation) {
        estado.textContent = 'Este navegador no permite compartir la ubicación. ' + PLAN_B_UBICACION;
        return;
    }

    const alEncontrar = posicion => {
        boton.disabled = false;
        ubicacion = {
            latitud: posicion.coords.latitude,
            longitud: posicion.coords.longitude,
            precision: Math.round(posicion.coords.accuracy)
        };
        texto.textContent = 'Quitar mi ubicación';
        estado.textContent = ubicacion.precision > PRECISION_ACEPTABLE
            ? 'Listo, pero es aproximada (unos ' + ubicacion.precision + ' m). Revisá que la dirección esté bien escrita.'
            : 'Listo: el pedido va a llevar un link con tu ubicación en el mapa.';
    };
    const alFallar = error => {
        boton.disabled = false;
        estado.textContent = explicarErrorUbicacion(error) + ' ' + PLAN_B_UBICACION;
    };

    boton.disabled = true;
    estado.textContent = 'Buscando tu ubicación…';
    // Primero con el GPS. Bajo techo suele tardar o no encontrar nada; ahí se
    // vuelve a probar con la ubicación aproximada (wifi y antenas).
    navigator.geolocation.getCurrentPosition(
        alEncontrar,
        error => {
            if (error.code === error.PERMISSION_DENIED) return alFallar(error);
            estado.textContent = 'Seguimos buscando tu ubicación…';
            navigator.geolocation.getCurrentPosition(
                alEncontrar,
                alFallar,
                { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60 * 1000 }
            );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60 * 1000 }
    );
}

// Cada falla se arregla distinto, así que se explica según el caso.
function explicarErrorUbicacion(error) {
    if (error.code !== error.PERMISSION_DENIED) {
        return 'No encontramos tu ubicación. Fijate que la ubicación del celular esté prendida y volvé a tocar el botón.';
    }
    const agente = navigator.userAgent;
    // Los navegadores que traen adentro Instagram, Facebook y otras apps no dejan compartirla.
    if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|musical_ly|; wv\)/i.test(agente)) {
        return 'Estás viendo la página dentro de otra app, que no deja compartir la ubicación. Abrila en Chrome o Safari desde el menú de la app (⋮ o …).';
    }
    if (/iPhone|iPad|iPod/.test(agente)) {
        return 'El iPhone tiene bloqueada la ubicación para el navegador. Entrá a Ajustes → Privacidad y seguridad → Localización y prendela. Después recargá la página (tu pedido no se pierde).';
    }
    return 'El navegador tiene bloqueada la ubicación para esta página. Tocá el ícono al lado de la dirección de la página y poné Ubicación en Permitir. Después recargá (tu pedido no se pierde).';
}

// --- Envío por WhatsApp -----------------------------------------------------

// Marca en rojo lo que falta y devuelve true si se puede enviar.
function validarEntrega() {
    const nombre = document.getElementById('entrega-nombre');
    const direccion = document.getElementById('entrega-direccion');
    const pagaCon = document.getElementById('entrega-paga-con');

    nombre.classList.toggle('is-invalid', !nombre.value.trim());
    direccion.classList.toggle('is-invalid', formaDeEntregaElegida() === ENVIO && !direccion.value.trim());
    // Opcional, pero si lo completa tiene que alcanzar para pagar el pedido.
    const pagaConInvalido = formaDePagoElegida() === 'Efectivo'
        && pagaCon.value.trim() !== ''
        && !(Number(pagaCon.value) >= totalDelPedido());
    pagaCon.classList.toggle('is-invalid', pagaConInvalido);

    const primerError = document.querySelector('#form-entrega .is-invalid');
    if (primerError) primerError.focus();
    return !primerError;
}

function armarMensaje() {
    let mensaje = '¡Hola Artesanales! Quiero hacer este pedido:\n\n';
    carrito.forEach(item => {
        const prod = buscarProducto(item.id);
        const unidad = prod.unidad ? ' (' + prod.unidad + ')' : '';
        mensaje += '*' + item.cantidad + 'x* ' + prod.nombre + unidad + ' - ' + formatearPrecio(precioDe(prod) * item.cantidad) + '\n';
    });
    mensaje += '\n*Total: ' + formatearPrecio(totalDelPedido()) + '*\n';

    const forma = formaDeEntregaElegida();
    mensaje += '\n*Datos*\n';
    mensaje += 'Nombre: ' + valorDe('entrega-nombre') + '\n';
    mensaje += 'Entrega: ' + forma + '\n';
    if (forma === ENVIO) {
        mensaje += 'Dirección: ' + valorDe('entrega-direccion') + '\n';
        if (ubicacion) {
            mensaje += 'Ubicación: https://www.google.com/maps?q=' + ubicacion.latitud + ',' + ubicacion.longitud;
            if (ubicacion.precision > PRECISION_ACEPTABLE) mensaje += ' (aproximada, unos ' + ubicacion.precision + ' m)';
            mensaje += '\n';
        }
    }
    if (valorDe('entrega-indicaciones')) mensaje += 'Aclaraciones: ' + valorDe('entrega-indicaciones') + '\n';

    const pago = formaDePagoElegida();
    if (pago) {
        const pagaCon = valorDe('entrega-paga-con');
        mensaje += 'Pago: ' + pago;
        if (pago === 'Efectivo' && pagaCon) mensaje += ' (pago con ' + formatearPrecio(pagaCon) + ')';
        mensaje += '\n';
    }

    mensaje += forma === ENVIO ? '\n¿Me confirmás el costo y la demora del envío?' : '\n¿Me avisás cuando esté listo para retirar?';
    return mensaje;
}

function enviarPedidoWhatsApp(evento) {
    evento.preventDefault();
    if (carrito.length === 0) return;
    if (!validarEntrega()) return;
    guardarEntrega();
    window.open('https://wa.me/' + NEGOCIO.whatsapp + '?text=' + encodeURIComponent(armarMensaje()), '_blank', 'noopener');
}
