// Datos del negocio que usa el catálogo y el panel.
const NEGOCIO = {
    nombre: 'Artesanales',
    // Número que recibe los pedidos: con código de país, sin "+" ni espacios.
    whatsapp: '5493884683996',
    instagram: 'https://www.instagram.com/artesanalesquesos',
    direccion: 'Güemes 1253, San Salvador de Jujuy',
    mapa: 'https://www.google.com/maps/search/?api=1&query=G%C3%BCemes+1253+San+Salvador+de+Jujuy',
    // Formas de pago que se ofrecen al armar el pedido.
    formasDePago: ['Efectivo', 'Transferencia'],
    // Cómo recibe el pedido el cliente. Si elige "Envío", se le pide la dirección.
    formasDeEntrega: ['Retiro en el local', 'Envío a domicilio']
};

// Horario de atención (hora de Jujuy). Día: 0 = domingo, 1 = lunes ... 6 = sábado.
// Sirve para mostrar "Abierto ahora" o "Cerrado"; los pedidos se pueden mandar igual.
const HORARIOS = {
    zona: 'America/Argentina/Jujuy',
    dias: {
        1: [8, 17], 2: [8, 17], 3: [8, 17], 4: [8, 17], 5: [8, 17],
        6: [8, 13]
    },
    texto: ['Lunes a viernes de 8 a 17 hs', 'Sábados de 8 a 13 hs']
};

// Categorías del catálogo. El orden de esta lista es el orden de los filtros.
// En el catálogo solo aparecen las que tienen al menos un producto.
const CATEGORIAS = ['Quesos', 'Fiambres', 'Dulces y conservas', 'Otros'];

// Dónde viven los productos. No hay base de datos: la lista está en
// data/productos.json, dentro de este mismo repositorio de GitHub, y el panel
// la cambia haciendo un commit (ver DESPLIEGUE.md).
const REPO = {
    usuario: 'SquicciariniLautaro',
    nombre: 'artesanales',
    // La rama que publica GitHub Pages.
    rama: 'main',
    archivoProductos: 'data/productos.json',
    carpetaFotos: 'img/productos'
};
