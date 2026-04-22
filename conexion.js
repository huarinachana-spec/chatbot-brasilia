const mysql = require('mysql2');

const conexion = mysql.createConnection({

  host: 'localhost',
  user: 'root',
  password: 'root123', // si tienes contraseña, ponla aquí
  database: 'tienda_toners'
});

conexion.connect((err) => {
  if (err) {
    console.error('Error de conexión:', err);
    return;
  }

  console.log('Conectado a MySQL 🚀');

conexion.query('SELECT * FROM productos LIMIT 5', (err, results) => {
    if (err) throw err;
    console.log(results);
    conexion.end();
});
});
