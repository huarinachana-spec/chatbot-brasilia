const express = require('express');
const mysql = require('mysql');
const axios = require('axios');

const app = express();
const PORT = 3000;

// =========================
// CONFIG
// =========================
const VERIFY_TOKEN = 'mi_token_brasilia';
const WHATSAPP_TOKEN = 'EAAkSQNF1TYwBRfo9i5z7eRHr5OPrUvXZBZCf3FfA10tYIgGosaM363NLWvZBZAE6OIktMDT9LbFduNZCCpa1ZCJcd5AxjZBv4CMifkyaZBCEUY73fZBFhB0KPwAcdZCgUZCrXqzxJLbZBmoeWe6XGNuZCpbTucr79x1NnNQJ12hTFXdj4r22X0LgXfAYGoDEtRvaOZC4gdwyQvNZCNWKdMbZBdadDdLR58Tw58vqBiZC0igvCpYgs36yRMBpEf2GRNg6UnRZBxAqyFM1FKCCRhFiZBG7SF5QB3EvpPl';
const PHONE_NUMBER_ID = '1007124599161882';

// =========================
// MIDDLEWARE
// =========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// MYSQL
// =========================
const conexion = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root123',
  database: 'tienda_toners'
});

conexion.connect((err) => {
  if (err) {
    console.error('Error de conexión a MySQL:', err);
    return;
  }
  console.log('Conectado a MySQL');
});

// =========================
// MEMORIA SIMPLE DE ESTADO
// =========================
const estadosUsuario = {};

// =========================
// RUTA PRINCIPAL
// =========================
app.get('/', (req, res) => {
  res.send('API funcionando');
});

// =========================
// VERIFICACIÓN WEBHOOK META
// =========================
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('MODE:', mode);
  console.log('TOKEN META:', token);
  console.log('TOKEN CODIGO:', VERIFY_TOKEN);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado correctamente');
    return res.status(200).send(challenge);
  } else {
    console.log('Error de verificación del webhook');
    return res.sendStatus(403);
  }
});

// =========================
// WEBHOOK MENSAJES ENTRANTES
// =========================
app.post('/webhook', async (req, res) => {
  try {
    console.log('ENTRÓ AL WEBHOOK');
    console.log(JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return res.sendStatus(200);
    }

    const mensaje = messages[0];
    const from = mensaje.from;
    const textoOriginal = mensaje.text?.body?.trim();

    if (!textoOriginal) {
      return res.sendStatus(200);
    }

    const texto = textoOriginal.toLowerCase().trim();
    console.log('Mensaje recibido:', texto);

    if (!estadosUsuario[from]) {
      estadosUsuario[from] = {
        paso: 'menu'
      };
    }

    // =========================
    // COMANDOS GLOBALES
    // =========================
    if (texto === 'hola' || texto === 'menu' || texto === 'menú' || texto === 'inicio') {
      estadosUsuario[from] = { paso: 'menu' };
      await enviarMenuPrincipal(from);
      return res.sendStatus(200);
    }

    if (texto === 'asesor' || texto === 'hablar con asesor' || texto === '5') {
      estadosUsuario[from] = { paso: 'asesor' };
      await enviarMensajeWhatsApp(
        from,
        'Claro 🙂 Un asesor puede ayudarte con información más detallada. En breve nos pondremos en contacto contigo.'
      );
      return res.sendStatus(200);
    }
    
    if (texto === "menu") {
  estadosUsuario[from] = { paso: 'menu' };
  await enviarMenuPrincipal(from);
  return res.sendStatus(200);
}
    // =========================
    // MENÚ PRINCIPAL
    // =========================
    if (estadosUsuario[from].paso === 'menu') {
      if (texto === '1') {
        estadosUsuario[from] = { paso: 'esperando_toner' };
        await enviarMensajeWhatsApp(
          from,
          'Has elegido TONERS 🖨️\n\nEscríbeme el modelo o código del toner.\nEjemplos:\n• 85A\n• 83A\n• HP 12A'
        );
        return res.sendStatus(200);
      }

      if (texto === '2') {
        estadosUsuario[from] = { paso: 'esperando_camara' };
        await enviarMensajeWhatsApp(
          from,
          'Has elegido CÁMARAS 📷\n\nEscríbeme la marca o modelo de la cámara que buscas.\nEjemplos:\n• Hikvision\n• Dahua\n• DS-2CE56D0T-IR'
        );
        return res.sendStatus(200);
      }

      if (texto === '3') {
        estadosUsuario[from] = { paso: 'esperando_biometrico' };
        await enviarMensajeWhatsApp(
          from,
          'Has elegido BIOMÉTRICOS 👆\n\nEscríbeme la marca o modelo del biométrico.\nEjemplos:\n• ZKTeco\n• K40\n• LX50'
        );
        return res.sendStatus(200);
      }

      if (texto === '4') {
        estadosUsuario[from] = { paso: 'viendo_servicios' };
        await consultarServicios(from);
        return res.sendStatus(200);
      }

      await enviarMensajeWhatsApp(
        from,
        'No entendí tu opción.\n\nEscribe:\n1 para Toners\n2 para Cámaras\n3 para Biométricos\n4 para Servicios\n5 para Hablar con asesor'
      );
      return res.sendStatus(200);
    }

    // =========================
    // TONERS
    // =========================
    if (estadosUsuario[from].paso === 'esperando_toner') {
      await consultarCategoria(from, textoOriginal, 'Toner');
      return res.sendStatus(200);
    }

    // =========================
    // CÁMARAS
    // =========================
    if (estadosUsuario[from].paso === 'esperando_camara') {
      await consultarCategoria(from, textoOriginal, 'Camara');
      return res.sendStatus(200);
    }

    // =========================
    // BIOMÉTRICOS
    // =========================
    if (estadosUsuario[from].paso === 'esperando_biometrico') {
      await consultarCategoria(from, textoOriginal, 'Biometrico');
      return res.sendStatus(200);
    }

    // =========================
    // FALLBACK
    // =========================
    await enviarMensajeWhatsApp(
      from,
      'No entendí tu mensaje.\n\nEscribe "menu" para ver las opciones disponibles.'
    );

    return res.sendStatus(200);

  } catch (error) {
    console.error('Error en webhook:', error);
    return res.sendStatus(500);
  }
});

// =========================
// CONSULTA POR CATEGORÍA
// =========================
async function consultarCategoria(numero, textoUsuario, categoria) {
  return new Promise((resolve) => {
    let textoLimpio = textoUsuario.toLowerCase().trim();

    // limpieza básica
    textoLimpio = textoLimpio
      .replace('hp', '')
      .replace('toner', '')
      .replace('tóner', '')
      .trim();

    console.log('Texto limpio:', textoLimpio, 'Categoría:', categoria);

    const query = `
  SELECT DISTINCT modelo, nombre, marca, precio, stock, descripcion, categoria
  FROM productos
  WHERE categoria = ?
  AND (modelo LIKE ? OR nombre LIKE ? OR marca LIKE ?)
  LIMIT 5
`;

    const valor = `%${textoLimpio}%`;

    conexion.query(query, [categoria, valor, valor, valor, valor], async (err, resultados) => {
      if (err) {
        console.error('Error en consulta:', err);
        await enviarMensajeWhatsApp(numero, 'Ocurrió un error al consultar la base de datos.');
        return resolve();
      }

      if (resultados.length === 0) {
        await enviarMensajeWhatsApp(
          numero,
          'No encontré un producto con esa referencia.\n\nEscribe "menu" para ver las opciones disponibles.'
        );
        return resolve();
      }

      let respuesta = '📦 *Productos encontrados:*\n\n';

resultados.forEach((p, i) => {
  respuesta += `${i + 1}. *${p.nombre}*\n`;
  respuesta += `🏷 Marca: ${p.marca || 'N/A'}\n`;
  respuesta += `🔢 Modelo: ${p.modelo}\n`;
  respuesta += `💰 Precio: Bs. ${Number(p.precio).toFixed(2)}\n`;
  respuesta += `📦 Stock: ${p.stock}\n`;

  if (p.descripcion) {
    respuesta += `📝 ${p.descripcion}\n`;
  }

  respuesta += '\n';
});

respuesta += '👉 Escribe *menu* para volver al inicio';


      await enviarMensajeWhatsApp(numero, respuesta);
      return resolve();
    });
  });
}

// =========================
// CONSULTAR SERVICIOS
// =========================
async function consultarServicios(numero) {
  return new Promise((resolve) => {
    const query = `
      SELECT id, nombre, precio, descripcion
      FROM productos
      WHERE categoria = 'Servicio'
      ORDER BY nombre
    `;

    conexion.query(query, async (err, resultados) => {
      if (err) {
        console.error('Error al consultar servicios:', err);
        await enviarMensajeWhatsApp(numero, 'Ocurrió un error al consultar los servicios.');
        return resolve();
      }

      if (resultados.length === 0) {
        await enviarMensajeWhatsApp(numero, 'No hay servicios registrados actualmente.');
        return resolve();
      }

      let respuesta = 'Servicios disponibles 🛠️\n\n';

      resultados.forEach((servicio, index) => {
        respuesta += `${index + 1}. ${servicio.nombre}\n`;
        respuesta += `Precio: Bs. ${Number(servicio.precio).toFixed(2)}\n`;
        if (servicio.descripcion) {
          respuesta += `Descripción: ${servicio.descripcion}\n`;
        }
        respuesta += `\n`;
      });

      respuesta += 'Escribe "menu" para volver al menú principal.';

      await enviarMensajeWhatsApp(numero, respuesta);
      return resolve();
    });
  });
}

// detectar intención directa (sin menú)
if (texto.includes("toner") || texto.match(/\d{2,3}[a-zA-Z]?/)) {
  estadosUsuario[from] = { paso: 'esperando_toner' };
  await consultarCategoria(from, textoOriginal, 'Toner');
  return res.sendStatus(200);
}
// =========================
// MENÚ PRINCIPAL
// =========================
async function enviarMenuPrincipal(numero) {
  const mensaje =
    '🤖 *BrasiliaBot*\n\n' +
    'Hola 👋 soy el asistente virtual de *Importadora Brasilia*\n\n' +
    'Puedo ayudarte con:\n\n' +
    '1️⃣ Toners\n' +
    '2️⃣ Cámaras de seguridad\n' +
    '3️⃣ Equipos biométricos\n' +
    '4️⃣ Servicios técnicos\n' +
    '5️⃣ Hablar con asesor\n\n' +
    '✍️ Escribe el número de la opción que deseas consultar';

  await enviarMensajeWhatsApp(numero, mensaje);
}

// =========================
// ENVIAR MENSAJE WHATSAPP
// =========================
async function enviarMensajeWhatsApp(numero, mensaje) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: numero,
        type: 'text',
        text: {
          body: mensaje
        }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Mensaje enviado correctamente');
  } catch (error) {
    console.error(
      'Error enviando mensaje:',
      error.response?.data || error.message
    );
  }
}

// =========================
// ENDPOINT OPENAPI
// =========================
app.post('/consultar-toner', (req, res) => {
  let { modelo } = req.body;

  if (!modelo) {
    return res.status(400).json({
      error: 'Debes enviar el campo modelo'
    });
  }

  modelo = modelo.toLowerCase().replace('hp', '').replace('toner', '').trim();

  const query = `
    SELECT id, nombre, marca, modelo, categoria, precio, stock, descripcion, compatibilidad
    FROM productos
    WHERE categoria = 'Toner'
    AND (modelo LIKE ? OR nombre LIKE ?)
    ORDER BY nombre
    LIMIT 5
  `;

  const valor = `%${modelo}%`;

  conexion.query(query, [valor, valor], (err, resultados) => {
    if (err) {
      console.error('Error en consulta toner:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }

    if (resultados.length > 0) {
      return res.json({
        mensaje: 'Producto encontrado',
        productos: resultados
      });
    } else {
      return res.json({
        mensaje: 'No se encontró el producto',
        productos: []
      });
    }
  });
});

// =========================
// INICIO SERVIDOR
// =========================
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});