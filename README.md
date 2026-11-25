# PAMCE · Backend

API del sistema **PAMCE** (Premio Anual al Mérito Científico y Empresarial), proyecto de grado del Programa de Ingeniería de Sistemas de la Universidad Francisco de Paula Santander.

PAMCE gestiona el premio que la universidad otorga a egresados y estudiantes de últimos semestres. Cada **edición** pasa por tres etapas: **convocatoria**, **evaluación** y **premiación**.

## Roles

El acceso se controla por el **rol activo** de la sesión. Un usuario con varios roles debe cambiar de rol para usar las funciones de cada uno.

| Rol | Qué hace |
|---|---|
| Administrador | Gestiona usuarios (directores, jurados, participantes) y consulta la auditoría |
| Director | Organiza cada edición: fechas, categorías, requisitos, rúbricas, criterios y porcentajes. Invita por correo, revisa postulaciones, asigna jurados y genera reportes |
| Jurado | Evalúa las participaciones asignadas, criterio por criterio, durante la etapa de evaluación |
| Participante | Se postula, corrige sus requisitos mientras la postulación está pendiente, consulta resultados y descarga su certificado |

## Tecnologías

- Node.js 20 o superior, Express 5
- PostgreSQL con Sequelize
- JWT en cookies `httpOnly` (acceso de 1 hora y refresh de 7 días)
- Firebase Admin (inicio de sesión con Google)
- node-cron (tareas programadas), Nodemailer, PDFKit y ExcelJS

## Instalación

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Crea la base de datos y restaura el respaldo (PostgreSQL 17 o superior):

   ```bash
   createdb BD_PAMCE_UFPS
   pg_restore -d BD_PAMCE_UFPS --no-owner --no-privileges ruta/al/BD_PAMCE_UFPS.backup
   psql -d BD_PAMCE_UFPS -f database/historico_ediciones.sql
   ```

   `historico_ediciones` la usa el archivado automático y no viene en el respaldo del 09/10/2026.

3. Copia `.env.example` como `.env` y completa los valores (cada variable está explicada en el archivo).

4. Coloca la clave de la cuenta de servicio de Firebase en `src/utils/serviceAccountKey.json`, o indica su ruta con `FIREBASE_CREDENTIALS_PATH`.

5. Inicia el servidor:

   ```bash
   npm run dev     # desarrollo (nodemon)
   npm start       # producción
   ```

> **Nunca subas al repositorio** el `.env`, la clave de Firebase, los respaldos de la base ni la carpeta `src/documentos/`. El `.gitignore` ya los excluye.

## Scripts de base de datos (`database/`)

| Archivo | Para qué sirve |
|---|---|
| `historico_ediciones.sql` | Crea la tabla del histórico de ediciones archivadas |
| `corregir_es_ganador.sql` | Marca los ganadores de ediciones ya premiadas, según su puesto |
| `limpieza_rol_jurado_postulantes.sql` | Quita el rol de jurado que se asignaba por error al postularse |

Los dos últimos corrigen datos generados por bugs ya resueltos. Muestran una vista previa y se ejecutan en una transacción.

## Tareas programadas

Se inician solo después de confirmar la conexión con la base de datos, y usan la hora de Colombia.

| Tarea | Cuándo | Qué hace |
|---|---|---|
| `edicionEnProceso` | 00:00 | Pasa la edición a *en_proceso* desde su fecha de inicio |
| `validacionInicioEtapaConvocatoria` | 00:00 | Al iniciar la convocatoria, inactiva las categorías con configuración incompleta |
| `validacionInicioEtapaEvaluacion` | 00:50 | Al iniciar la evaluación, rechaza las postulaciones pendientes y las aceptadas sin jurado |
| `procesarPremiacion` | 00:00 | Calcula las notas y los ganadores por categoría. Si una categoría falla, avisa al director y reintenta |
| `edicionFinalizada` | 00:00 | Finaliza la edición después de su fecha de fin |
| `archivarEdiciones` | 02:00 | Cinco años después, guarda un histórico verificado y elimina los datos y los documentos |
| Notificaciones y recordatorios | Diario | Avisos de inicio de etapas y de evaluaciones pendientes |

Las tareas de inicio de etapa se ponen al día si el servidor estuvo apagado ese día, sin repetir trabajo.

## Cálculo de la nota

Para cada criterio se promedian las notas (de 0 a 5) de los jurados que completaron la evaluación:

```
nota final = Σ (peso de la rúbrica × peso del criterio × promedio del criterio)
```

En cada categoría ganan los N primeros (N = número de ganadores de la categoría). En caso de empate, gana la postulación más antigua.

## Podman

El despliegue usa [Podman](https://podman.io/) (funciona sin root). La imagen se define en `Containerfile`.

### Con compose (PostgreSQL + backend)

1. Copia `.env.example` como `.env`, complétalo y usa `DB_HOST=db`.
2. Coloca la clave de Firebase en `secrets/serviceAccountKey.json` (el `.gitignore` ya la excluye). Sin root dentro del contenedor, el archivo debe poder leerlo cualquier usuario: `chmod 644 secrets/serviceAccountKey.json`.
3. Levanta todo:

   ```bash
   podman compose up -d --build
   podman compose logs -f backend
   ```

4. La base nace vacía. Restaura el respaldo y el script del histórico (reemplaza `<DB_USER>` y `<DB_NAME>` por los del `.env`):

   ```bash
   podman compose exec -T db pg_restore -U <DB_USER> -d <DB_NAME> --no-owner --no-privileges < ruta/BD_PAMCE_UFPS.backup
   podman compose exec -T db psql -U <DB_USER> -d <DB_NAME> < database/historico_ediciones.sql
   ```

Si la universidad ya ofrece un PostgreSQL, borra el servicio `db` de `compose.yaml` y apunta `DB_HOST` a ese servidor.

En un servidor con SELinux (RHEL, Rocky, Fedora) agrega `,Z` al montaje de la clave de Firebase en `compose.yaml`.

### Sin compose

```bash
podman build -t pamce-backend -f Containerfile .
podman run -d --name pamce-backend -p 4000:4000 --env-file .env \
  -v pamce_documentos:/app/src/documentos \
  -v ./secrets/serviceAccountKey.json:/secrets/firebase.json:ro,Z \
  -e FIREBASE_CREDENTIALS_PATH=/secrets/firebase.json \
  localhost/pamce-backend
```

### Arranque automático en el servidor (systemd)

`deploy/pamce-backend.container` es una unidad Quadlet. Con la imagen ya construida y la base disponible:

```bash
mkdir -p ~/pamce/secrets ~/.config/containers/systemd
cp .env ~/pamce/.env && cp secrets/serviceAccountKey.json ~/pamce/secrets/
cp deploy/pamce-backend.container ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user start pamce-backend
loginctl enable-linger $USER    # sigue corriendo al cerrar la sesión
```

## Estructura

```
src/
├── app.js, index.js     Configuración de Express y arranque
├── configs/             Base de datos, JWT y plantillas de correo
├── controller/          Lógica de cada recurso
├── middlewares/         Middlewares de Express y tareas programadas
├── models/              Modelos de Sequelize y asociaciones (index.js)
├── routes/              Rutas, con verificarToken y verificarRol
├── schemas/             Validaciones con zod
├── utils/               Fechas, sanitización, OTP, auditoría, histórico
└── documentos/          Archivos subidos por los participantes (no se versiona)
```
