const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');
const app = express();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const port = process.env.PORT || 3000; // Puerto desde .env o valor por defecto
require('dotenv').config();
timezone: 'America/Tijuana'



// Configuración de la sesión
app.use(session({
  secret: 'secretKey',
  resave: false,
  saveUninitialized: false,
}));
app.use(express.urlencoded({ extended: true }));

// Validacion de rol
function requireRole(role) {
  return (req, res, next) => {
      if (req.session.user && req.session.user.tipo_usuario === role) {
          next();
      } else {
          res.status(403).send('Acceso denegado');
      }
  };
}
  
  // Middleware para verificar el inicio de sesión
  function requireLogin(req, res, next) {
    if (!req.session.user) {
      return res.redirect('/login.html');
    }
    next();
  }

// Ruta protegida (Página principal después de iniciar sesión)
app.get('/', requireLogin,(req, res) => {
    const username = req.session.user.nombre_usuario;
    res.sendFile(path.join(__dirname, 'public', 'index.html'), {username} );
  });

  // Ruta para que solo el headcoach pueda ver todos los usuarios
app.get('/ver-entrenadores', requireLogin, requireRole('Headcoach'), (req, res) => {
  const query = 'SELECT * FROM contar_clientes;';
  connection.query(query,(err, results) => {
    if (err) {
      return res.send('Error al obtener los datos.');
    }

    let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Entrenadores</title>
      </head>
      <body>
        <h1>Entrenadores Registrados</h1>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Numero de clientes</th>
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach(usuarios => {
      html += `
        <tr>
          <td>${usuarios.id}</td>
          <td>${usuarios.nombre_usuario}</td>
          <td>${usuarios.numero_clientes}</td>
         
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <button onclick="window.location.href='/'">Volver</button> <button onclick="window.location.href='/sumar-ingresos'">Ver Ingresos de los entrenadores</button>
      </body>
      </html>
    `;

    res.send(html);
  });
});

// Ruta para guardar datos en la base de datos
app.post('/submit-data', requireLogin, (req, res) => {
  const { nombre, apellido, correo, telefono, mensualidad, coach_id} = req.body;
  const query = 'INSERT INTO pacientes (nombre_paciente, apellido_paciente, correo_paciente, telefono_paciente, mensualidad_paciente, entrenador_id) VALUES (?, ?, ?, ?, ?, ?);';
  connection.query(query, [nombre, apellido, correo, telefono, mensualidad, coach_id], (err, result) => {
    if (err) {
      return res.send('Error al guardar los datos en la base de datos.');
    }

    let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Paciente Registrado</title>
      </head>
      <body>
        <h2>${nombre} ${apellido} guardado en la base de datos.</h2>
          <tbody>
    `;

    html += `
    </tbody>
  <button onclick="window.location.href='/'">Volver</button>
</body>
</html>
`;

res.send(html);
  });
});

// Ruta para cargar el formulario de edición de pacientes
app.get('/editar-paciente', requireLogin, requireRole('Coach'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'editar-paciente.html'));
  });

  // Ruta para la Busqueda en tiempo real
app.get('/buscar', (req, res) => {
  const query = req.query.query;
  const sql = ` SELECT id, nombre_paciente, apellido_paciente, correo_paciente, telefono_paciente, mensualidad_paciente, Entrenador FROM entrenador_paciente WHERE nombre_paciente LIKE ?;`;
  connection.query(sql, [`%${query}%`], (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});
 
// Ruta para actualizar los datos de un paciente
app.get('/iniciar', requireLogin, requireRole('Coach'), (req, res) => {
  const sql = 'START TRANSACTION;';
  connection.query(sql, (err, result) => {
      if (err) {
          return res.send('Error al iniciar la transacción.');
      }
      res.redirect('/editar-paciente.html');
  });
});


//Ruta para editar pacientes
app.post('/editar-paciente', requireLogin, requireRole('Coach'), (req, res) => {
  const { id, nombre, apellido, correo, telefono, mensualidad } = req.body;
  const query = 'UPDATE pacientes SET nombre_paciente = ?, apellido_paciente = ?, correo_paciente = ?, telefono_paciente = ? , mensualidad_paciente = ?  WHERE id = ?;';
  connection.query(query, [nombre, apellido, correo, telefono, mensualidad, id], (err, result) => {
    if (err) {
      return res.send('Error al actualizar los datos del paciente.');
    }

    let html = `
    <html>
    <head>
      <link rel="stylesheet" href="/styles.css">
      <h1>Datos del paciente</h1>
    </head>
    <body>
      <h2>${nombre} ${apellido} se edito correctamente.</h2>
        <tbody>
  `;

  html += `
  </tbody>
<button onclick="window.location.href='/editar-paciente'">Volver</button>
</body>
</html>
`;

res.send(html);
});
});

app.get('/aceptar', requireLogin, requireRole('Coach'), (req, res) => {
  const sql = 'COMMIT;';
  connection.query(sql, (err, result) => {
      if (err) {
          return res.send('Error al confirmar la transacción.');
      }
      let html = `
          <html>
          <head>
              <link rel="stylesheet" href="/styles.css">
              <h1>Datos del paciente</h1>
          </head>
          <body>
              <h2>Los datos editados se han guardado correctamente.</h2>
              <button onclick="window.location.href='/editar-paciente'">Volver</button>
          </body>
          </html>
      `;
      res.send(html);
  });
});


app.get('/cancelar', requireLogin, requireRole('Coach'), (req, res) => {
  const sql = 'ROLLBACK;';
  connection.query(sql, (err, result) => {
      if (err) {
          return res.send('Error al cancelar la transacción.');
      }
      let html = `
          <html>
          <head>
              <link rel="stylesheet" href="/styles.css">
              <h1>Datos del paciente</h1>
          </head>
          <body>
              <h2>Los datos editados del paciente no se guardaron.</h2>
              <button onclick="window.location.href='/'">Volver</button>
          </body>
          </html>
      `;
      res.send(html);
  });
});

//subconsulta para obtener los clientes de los entrenadores
app.post('/contar-pacientes', requireLogin, requireRole('Headcoach'), (req, res) => {
  const {nombre} = req.body;
  const sql = 'SELECT id, nombre_paciente, apellido_paciente FROM pacientes WHERE entrenador_id IN (SELECT id FROM usuarios WHERE nombre_usuario = ?);';
  connection.query(sql, [nombre], (err, result) => {  
    if (err) {
      return res.send('Error al obtener los datos.');
    }

    let html = `
    <html>
    <head>
      <link rel="stylesheet" href="/styles.css">
      <title>Pacientes</title>
    </head>
    <body>
      <h1>Pacientes</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Apellido</th>
          </tr>
        </thead>
        <tbody>
  `;

  result.forEach(paciente => {
    html += `
      <tr>
        <td>${paciente.id}</td>
        <td>${paciente.nombre_paciente}</td>
        <td>${paciente.apellido_paciente}</td>
    `;
  });

  html += `
        </tbody>
      </table>
      <button onclick="window.location.href='/'">Volver</button>  <button onclick="window.location.href='/contar-pacientes.html'">Buscar por entrenador</button> 
    </body>
    </html>
  `;

  res.send(html);
});
});


//Suma de mensualidades
app.get('/sumar-ingresos', requireLogin, requireRole('Headcoach'), (req, res) => {
  const sql = 'SELECT usuarios.nombre_usuario, SUM(pacientes.mensualidad_paciente) AS ingresos_entrenadores FROM pacientes JOIN usuarios ON pacientes.entrenador_id = usuarios.id GROUP BY usuarios.nombre_usuario;';
  connection.query(sql, (err, result) => {  
    if (err) {
      return res.send('Error al obtener los datos.');
    }

    let html = `
    <html>
    <head>
      <link rel="stylesheet" href="/styles.css">
      <title>Pacientes</title>
    </head>
    <body>
      <h1>Ingreso de los entrenadores</h1>
      <table>
        <thead>
          <tr>
            <th>Entrenador</th>
            <th>Ingresos</th>
          </tr>
        </thead>
        <tbody>
  `;

  result.forEach(usuario => {
    html += `
      <tr>
        <td>${usuario.nombre_usuario}</td>
        <td>${usuario.ingresos_entrenadores}</td>
    `;
  });

  html += `
        </tbody>
      </table>
      <button onclick="window.location.href='/'">Volver</button>  
    </body>
    </html>
  `;

  res.send(html);
});
});



// Ruta para que el Headcoach puedan ver todos pacientes
app.get('/ver-pacientes', requireLogin, requireRole('Headcoach'), (req, res) => {
  // Lógica de consulta para ver pacientes
  connection.query('SELECT * FROM pacientes_registro;', (err, results) => {
    if (err) {
      return res.send('Error al obtener los datos.');
    }

    let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Pacientes</title>
      </head>
      <body>
        <h1>Pacientes Registrados</h1>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Apellido</th>
              <th>Correo</th>
              <th>Telefono</th>
              <th>Mensualidad</th>
              <th>Fecha de registro </th>
              <th>Entrenador</th>
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach(paciente => {
      html += `
        <tr>
          <td>${paciente.nombre_paciente}</td>
          <td>${paciente.apellido_paciente}</td>
          <td>${paciente.correo_paciente}</td>
          <td>${paciente.telefono_paciente}</td>
          <td>${paciente.mensualidad_paciente}</td>
          <td>${paciente.fecha_registro}</td>
          <td>${paciente.entrenador}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <button onclick="window.location.href='/'">Volver</button>  <button onclick="window.location.href='/contar-pacientes.html'">Buscar por entrenador</button> 
      </body>
      </html>
    `;

    res.send(html);
  });
});



//subir archivos excel
const upload = multer({ dest: 'uploads/' });
app.post('/upload', upload.single('excelFile'), requireLogin, requireRole ('Headcoach'), (req, res) => {
  const filePath = req.file.path;
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  data.forEach(row => {
    const { nombre, cantidad, descripcion } = row;
    const sql = `INSERT INTO equipos (nombre, cantidad, descripcion) VALUES (?, ?, ?);`;
    connection.query(sql, [nombre, cantidad, descripcion], err => {
      if (err) throw err;
    });
  });

  res.send('<h1>Archivo cargado y datos guardados</h1><a href="/equipos.html">Volver</a>');
});

//descargar archivo 
app.get('/download', requireLogin, requireRole('Headcoach'), (req, res) => {
  const sql = `SELECT * FROM equipos`;
  connection.query(sql, (err, results) => {
    if (err) throw err;

    const worksheet = xlsx.utils.json_to_sheet(results);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Equipos');

    const filePath = path.join(__dirname, 'uploads', 'equipos_entrenamiento.xlsx');
    xlsx.writeFile(workbook, filePath);
    res.download(filePath, 'equipos.xlsx');
  });
});


//Descargar archivos pdf
app.get('/download-pdf', requireLogin, requireRole('Headcoach'), (req, res) => {
  const query = 'SELECT * FROM equipos';

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener los equipos:', err);
      return res.status(500).send('Error al generar el archivo PDF.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="equipos_entrenamiento.pdf"');

    const doc = new PDFDocument();

    doc.pipe(res);

    doc.text('Lista de Equipo de entrenamiento', { align: 'center', underline: true });
    doc.moveDown(2);

    results.forEach(row => {
      doc.text(`ID: ${row.id}`);
      doc.text(`Nombre: ${row.nombre}`);
      doc.text(`Cantidad: ${row.cantidad}`);
      doc.text(`Descripcion: ${row.descripcion}`);
      doc.moveDown(1);
    });

    doc.end();
  });
});


// Ruta para que los entrenadores puedan ver sus pacientes
app.get('/ver-mis-pacientes', requireLogin, requireRole('Coach'), (req, res) => {
  // Lógica de consulta para ver mis pacientes
  const userID = req.session.user.id;
  const query = 'SELECT * FROM pacientes WHERE entrenador_id = ?';
  connection.query(query, [userID], (err, result) => {
    if (err) {
      return res.send('Error al obtener los datos.');
    }

    let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Pacientes</title>
      </head>
      <body>
        <h1>Pacientes Registrados</h1>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Apellido</th>
              <th>Correo</th>
              <th>Telefono</th>
              <th>Mensualidad</th>
            </tr>
          </thead>
          <tbody>
    `;

    result.forEach(paciente => {
      html += `
        <tr>
          <td>${paciente.id}</td>
          <td>${paciente.nombre_paciente}</td>
          <td>${paciente.apellido_paciente}</td>
          <td>${paciente.correo_paciente}</td>
          <td>${paciente.telefono_paciente}</td>
          <td>${paciente.mensualidad_paciente}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <button onclick="window.location.href='/'">Volver</button>  <button onclick="window.location.href='/iniciar'">Editar Paciente</button>
      </body>
      </html>
    `;

    res.send(html);
  });
});


// Servir archivos estáticos (HTML)
app.use(express.static(path.join(__dirname, 'public')));

// app.use(bodyParser.urlencoded({ extended: true }));

// Configurar conexión a MySQL
    const connection = mysql.createConnection({
    host: process.env.DB_HOST,       // Host desde .env
    user: process.env.DB_USER,       // Usuario desde .env
    password: process.env.DB_PASS,   // Contraseña desde .env
    database: process.env.DB_NAME    // Nombre de la base de datos desde .env
  });
  
  connection.connect(err => {
    if (err) {
      console.error('Error conectando a MySQL:', err);
      return;
    }
    console.log('Conexión exitosa a MySQL');
  });


  app.post('/signup', (req, res) => {
    const { username, password, codigo_acceso } = req.body;

    const query = 'SELECT tipo_usuario FROM codigos_acceso WHERE codigo = ?';
    connection.query(query, [codigo_acceso], (err, results) => {
        if (err || results.length === 0) {
            return res.send('Código de acceso inválido');
        }

        const tipo_usuario = results[0].tipo_usuario;
        const hashedPassword = bcrypt.hashSync(password, 10);

        const insertUser = 'INSERT INTO usuarios (nombre_usuario, password_hash, tipo_usuario) VALUES (?, ?, ?)';
        connection.query(insertUser, [username, hashedPassword, tipo_usuario], (err) => {
            if (err) return res.send('Error al registrar usuario');
            res.redirect('/login.html');
        });
    });
});

app.post('/login', (req, res) => {
  const { nombre_usuario, password } = req.body;

  // Consulta para obtener el usuario y su tipo
  const query = 'SELECT * FROM usuarios WHERE nombre_usuario = ?';
  connection.query(query, [nombre_usuario], (err, results) => {
      if (err) {
          return res.send('Error al obtener el usuario');
      }

      if (results.length === 0) {
          return res.send('Usuario no encontrado');
      }

      const user = results[0];

      // Verificar la contraseña
      const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
      if (!isPasswordValid) {
          return res.send('Contraseña incorrecta');
      }

      // Almacenar la información del usuario en la sesión
      req.session.user = {
          id: user.id,
          username: user.nombre_usuario,
          tipo_usuario: user.tipo_usuario // Aquí se establece el tipo de usuario en la sesión
      };

      // Redirigir al usuario a la página principal
      res.redirect('/');
  });
});

// Ruta para obtener el tipo de usuario actual
app.get('/tipo-usuario', requireLogin, (req, res) => {
  res.json({ tipo_usuario: req.session.user.tipo_usuario });
});


// Cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
  });

  // Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
  });
