const app = require('./app');
const sequelize = require('./configs/db');

// Primero se verifica la base de datos; si no responde, el servidor no
// arranca a medias ni programa tareas que fallarían cada noche
sequelize
    .authenticate()
    .then(() => {
        console.log('Conexión a la base de datos establecida.');

        app.iniciarTareasProgramadas();

        app.listen(app.get('port'), () => {
            console.log('Servidor escuchando en el puerto ' + app.get('port'));
        });
    })
    .catch((err) => {
        console.error('No se pudo conectar a la base de datos:', err);
        process.exit(1);
    });
