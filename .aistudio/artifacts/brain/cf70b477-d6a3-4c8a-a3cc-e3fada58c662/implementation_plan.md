# WeRoll 5E: Plan Maestro Unificado de Seguridad, Hub de Partidas, Bóveda en Servidor y Asistente IA

Arquitectura integral que fusiona el sistema de autenticación con preaprobación por Administrador, el Hub visual de selección de World Sheets (DM) y Player Sheets (Jugador), salas protegidas por clave, monitoreo de presencia en 4 estados (Activo, Pausa, Pensando, AFK), copias de seguridad rotativas de 2 versiones en el servidor Express, panel de control de administrador con base de datos de descargas, y creador con IA relacional guiado por borradores base.

---

### Decisiones Críticas y Aprobación del Usuario

> [!IMPORTANT]
> **Síntesis de directrices aprobadas y armonizadas de ambos planes:**
> 1. **Autenticación y Registro con Aprobación Previa**: Nuevas cuentas de usuario (`Jugador` o `Dungeon Master`) se registran con correo, nombre y rol, quedando en estado `PENDIENTE` hasta que el Administrador las aprueba en el panel de control. El Moderador/Admin cuenta con clave maestra directa.
> 2. **Hub Visual de Entrada (Pre-Mesa)**: En lugar de saltar directo a una ficha o pantalla de DM, se muestra un portal donde el DM selecciona/crea su World Sheet y define el código y clave de la mesa, y el jugador selecciona/crea su Player Sheet e introduce la clave de la mesa.
> 3. **Bóveda y Persistencia en Servidor Node/Express**: Almacenamiento estructurado en disco en `/server/data/` (usuarios, mesas, copias de seguridad de fichas, y world sheets) con panel del Administrador para ver usuarios registrados (correo, nombre, rol) y descargar cualquier respaldo o la base de datos completa.
> 4. **Respaldo Rotativo (2 Copias por Jugador)**: El servidor conserva las últimas 2 versiones de sesión de cada jugador (al unirse y al salir), rotando automáticamente para garantizar recuperación ante pérdidas.
> 5. **Monitoreo de Presencia en 4 Niveles**: Detección de interacción en tiempo real en la barra de sesión: Activo ($\le 1$ min), Pausa ($1-3$ min), Pensando ($3-10$ min) y Ausente/AFK ($> 10$ min con contador de tiempo).
> 6. **Borrador IA Relacional**: Pestaña dedicada en los modales de creación de NPCs, monstruos, lugares y objetos para que el DM defina la idea base y seleccione vínculos con otros NPCs o sitios antes de autorrellenar con la IA.

---

## 1. Visión General y Flujo de Usuario

```
                                  [ Pantalla Inicial WeRoll ]
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
                 [ Iniciar Sesión ]                            [ Registrarse ]
                          │                                           │
                          │                               (Estado: PENDIENTE)
                          │                                     │
                          │                         [ Administrador Aprueba ]
                          │                                     │
                          └─────────────────┬───────────────────┘
                                            ▼
                               [ Hub Visual de Partidas ]
                                            │
               ┌────────────────────────────┴───────────────────────────┐
               ▼                                                        ▼
    [ Portal Dungeon Master ]                                [ Portal Jugador ]
    • Seleccionar / Crear World Sheet                        • Seleccionar / Crear Player Sheet
    • Descargar / Subir World Sheet (JSON)                   • Descargar / Subir Ficha (JSON)
    • Definir Código de Mesa y Contraseña                    • Ingresar Código de Mesa y Contraseña
               │                                                        │
               └────────────────────────────┬───────────────────────────┘
                                            ▼
                           [ Sesión de Juego en Vivo ]
                           • Barra de Mesa con 4 Estados AFK
                           • Guardado Rotativo de 2 Copias en Servidor
                           • Mensaje en Vivo del DM proyectado
                           • Modales con Pestaña de Borrador IA Relacional
```

---

## 2. Experiencia de Usuario y Módulos de Interfaz

### 2.1 Hub de Partidas (Pre-Mesa)
- **Portal del DM**:
  - Catálogo de World Sheets (campañas guardadas localmente y en el servidor).
  - Selector de World Sheet activo o botón `+ Crear Nuevo Mundo`.
  - Tarjeta de configuración de la mesa:
    - Nombre / Código de la Mesa (ej. `MESA-DRAGON`).
    - Contraseña de la Mesa (obligatoria o configurable por el DM).
  - Botón: `[ ⚔️ Lanzar Pantalla del Dungeon Master ]`.
- **Portal del Jugador**:
  - Catálogo de Player Sheets del usuario con avatar, nivel, raza/clase, PG y CA.
  - Botón `+ Crear Nuevo Aventurero` y opción de importar ficha desde JSON.
  - Formulario de conexión a la mesa:
    - Campo `Código de la Mesa`.
    - Campo `Contraseña de la Mesa` (se valida contra el servidor antes de ingresar).
  - Botón: `[ 🛡️ Entrar a la Mesa ]`.

### 2.2 Pestaña "Borrador IA" en Modales del DM
- Pestañas en la cabecera del modal: `[ Formulario Manual ]` y `[ ✨ Borrador con IA ]`.
- Campos del Borrador IA:
  - **Nombre preliminar**: Opcional o tentativo.
  - **Concepto / Rol en la campaña**: "¿Qué es y cuál es su propósito en la historia?"
  - **Vínculos / Relaciones**: Selector múltiple que despliega los NPCs existentes y los Lugares del World Sheet para asociarlo (ej. "Lugarteniente de Gromm en la Taberna del Jabalí").
  - **Nivel / Tono**: Aliado, Neutral, Villano menor, Jefe de mazmorra.
  - Botón: `[ ✨ Autorrellenar Ficha con IA ]` — genera rasgos, acciones de combate, secretos y notas privadas respetando las relaciones seleccionadas.

### 2.3 Panel de Administrador & Bóveda de Nube
- Dentro de `HostSettingsModal`:
  - **Pestaña "Usuarios y Aprobaciones"**: Lista con correo, nombre, rol solicitado/actual y botones `Aprobar`, `Rechazar` y `Cambiar Rol`.
  - **Pestaña "Bóveda del Servidor"**:
    - Tabla de Fichas de Jugador almacenadas con sus 2 copias rotativas (fecha, versión y botón de descarga JSON).
    - Tabla de World Sheets de DM almacenados con botón de descarga JSON.
    - Botón `[ 📦 Descargar Respaldo Completo de Base de Datos ]`.
  - **Pestaña "Ajustes y Versiones"**: Título de cabecera (`WeRoll`), subtítulo, logo, clave de admin, modelo de IA (`gemini-flash-lite-latest` o `gemini-3.8-flash`) y blog de versiones que no se borra.

### 2.4 Barra de Presencia en 4 Estados AFK
- **Activo** ($\le 1$ min): `En Línea` con pulsación esmeralda.
- **Pausa** ($1-3$ min): `En Pausa` con tono ámbar suave.
- **Pensando** ($3-10$ min): `Pensando su turno...` con icono de reloj de arena y tono zafiro.
- **Ausente / AFK** ($> 10$ min): `Ausente (hace X min)` en gris neutro con tooltip del tiempo exacto.

---

## 3. Arquitectura Técnica y Estrategia de Persistencia

```
┌────────────────────────────────────────────────────────────────────────┐
│                          WeRoll Client (React)                         │
├────────────────────────────────────────────────────────────────────────┤
│  • useUserActivity Hook (captura mouse, teclas, touch, dados)          │
│  • HubSessionPortal (selección de World Sheets y Player Sheets)        │
│  • Auth & Registration Modal (flujo con estado PENDIENTE)              │
│  • PartySessionBar (renderizado de cuadrícula con 4 estados AFK)       │
│  • DMScreenView (con pestañas de Borrador IA y relaciones)             │
│  • HostSettingsModal (panel de usuarios, bóveda y descargas)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP Fetch
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express Backend (/server)                       │
├────────────────────────────────────────────────────────────────────────┤
│  • /api/auth/register, /api/auth/login, /api/auth/me                   │
│  • /api/admin/users, /api/admin/users/:id/approve, /api/admin/users/:id│
│  • /api/rooms/create, /api/rooms/verify, /api/rooms/leave              │
│  • /api/session/room/:code/heartbeat (con presenceStatus)              │
│  • /api/vault/sheets, /api/vault/worlds, /api/vault/backup-all         │
│  • /api/gemini/assist-entity (generación con contexto de relaciones)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Lectura/Escritura JSON Atómica
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Almacenamiento Persistente en Disco                    │
│      /server/data/users.json       /server/data/rooms.json             │
│      /server/data/sheets.json      /server/data/worlds.json            │
│      /server/data/backups.json     /server/data/settings.json          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Plan de Implementación por Etapas

### Fase 1: Capa de Persistencia y Data Store del Servidor
- Crear `src/server/dataStore.ts` con lectura y escritura síncrona/atómica para usuarios, salas, copias rotativas y mundos.
- Sembrar el usuario administrador inicial (`admin@weroll.app` o credenciales maestras).
- Implementar rutas en `src/server/api.ts`:
  - Registro de usuarios con estado `pending`.
  - Login solo para usuarios `approved` o `admin`.
  - Endpoints de administración: listar usuarios, aprobar, rechazar, cambiar rol.
  - Endpoints de salas con validación de clave del DM.
  - Endpoints de bóveda para almacenar y descargar Player Sheets y World Sheets.
  - Endpoint de respaldo completo de la base de datos en JSON.

### Fase 2: Hook de Actividad y Monitor de Presencia (4 Estados)
- Crear `src/utils/useUserActivity.ts` que escuche `mousemove`, `keydown`, `touchstart` y tiradas de dados.
- Mapear tiempos de inactividad: `active` ($\le 1$ min), `idle` ($1-3$ min), `thinking` ($3-10$ min), `afk` ($> 10$ min).
- Enviar el estado en el latido periódico a `/session/room/:roomCode/heartbeat`.
- Actualizar `PartySessionBar.tsx` para renderizar las insignias de estado y tiempos de ausencia.

### Fase 3: Hub Visual de Partidas (Pre-Mesa)
- Crear `src/components/hub/HubSessionPortal.tsx`:
  - Vista DM: listado de World Sheets con fechas, selector de mundo, creación de nuevo mundo, exportar/importar, y campos para nombre y contraseña de la sala.
  - Vista Jugador: listado de Player Sheets con avatar, nivel, raza/clase, creación de ficha, y formulario para ingresar código y clave de la mesa.
  - Botón de regreso al Hub en el encabezado superior para poder cambiar de ficha o mundo en cualquier momento.

### Fase 4: Borrador IA con Relaciones en Modales del DM
- Actualizar modales de creación en `DMScreenView.tsx` (NPCs, Monstruos, Lugares, Objetos):
  - Añadir pestaña "Borrador con IA".
  - Añadir campos de concepto base y selector de relaciones (vínculos con otros NPCs o Lugares existentes del World Sheet).
  - Implementar endpoint `/api/gemini/assist-entity` que acepte las relaciones y devuelva la entidad completa formateada.

### Fase 5: Panel de Control del Administrador y Descargas
- Actualizar `HostSettingsModal.tsx` con las pestañas de administración:
  - Lista de usuarios con correo, nombre, rol y botones de aprobación.
  - Explorador de fichas y mundos respaldados en el servidor con descarga individual de JSON.
  - Botón de descarga de la base de datos completa.

### Fase 6: Verificación y Compilación
- Ejecutar `compile_applet` y validar que todos los flujos se ejecuten sin errores.
