# Sistema de Autenticación, Aprobación de Usuarios, Seguridad de Mesas y Copias Rotativas

Plan de arquitectura e implementación para dotar a WeRoll de un sistema robusto de cuentas con preaprobación por Administrador, seguridad individual de hojas de personaje y espacio del DM, mesas protegidas por clave creada por el DM, detección de inactividad multinivel (4 estados de presencia) y copias de seguridad automáticas rotativas de 2 versiones por jugador guardadas en el servidor.

---

## Decisiones Críticas y Aprobación del Usuario

> [!IMPORTANT]
> A continuación se resumen las decisiones acordadas durante la fase interactiva de clarificación y las directrices seleccionadas para el desarrollo:

- **Persistencia y Backend**: Servidor Node/Express con base de datos estructurada persistente en disco (`/server/data/db.json` o almacenamiento transaccional local) para gestionar cuentas de usuario, solicitudes pendientes, mesas, contraseñas hash y copias de seguridad históricas sin depender de servicios externos de terceros.
- **Flujo de Respaldo Rotativo (2 Copias por Jugador)**: Cada vez que un jugador se conecta a la mesa y cuando se desconecta/cierra sesión, el servidor almacena una captura completa de su ficha. El sistema conserva estrictamente las últimas 2 versiones de sesión rotativas (`sesión actual` y `sesión previa`), reemplazando la copia más antigua al iniciar una tercera para que el administrador siempre cuente con un respaldo de recuperación ante pérdidas o errores.
- **Sistema de Presencia y 4 Modos de AFK (Jugadores y DM)**:
  1. **Activo**: $\le 1$ minuto desde la última interacción (movimiento de ratón, pulsación de tecla, cambios en ficha, tirada de dados).
  2. **En pausa**: Entre 1 y 3 minutos sin interacción.
  3. **Pensando / Deliberando**: Entre 3 y 10 minutos sin interacción (icono de concentración o reloj de arena y etiqueta clara).
  4. **Ausente (AFK)**: $> 10$ minutos sin interacción, mostrando además el tiempo transcurrido desde la última conexión ("Ausente hace 12 min").
- **Aprobación de Usuarios por Administrador**: Registro con correo, nombre y rol deseado (`Dungeon Master` o `Jugador`). El usuario queda en estado `PENDIENTE` sin acceso a crear campañas ni fichas hasta que el Administrador revise su perfil en el panel y presione **Aprobar** o **Rechazar**.
- **Mesas con Contraseña del DM**: El Dungeon Master configura el identificador/nombre de su mesa y una contraseña de acceso. Los jugadores solo pueden unirse a la partida si proporcionan el nombre de la mesa y la contraseña correcta.
- **Propiedad Estricta de Fichas y Espacio DM**:
  - Un jugador solo puede ver, editar y guardar su propia hoja asignada.
  - El DM tiene su propio archivo y espacio independiente (notas, monstruos, encuentros, audio, compendio y estadísticas), con guardado exclusivo.
- **Persistencia de Configuraciones y Versiones entre Publicaciones**: Mantenimiento de archivo de configuración maestro en el servidor para evitar que nuevas compilaciones o despliegues sobrescriban la contraseña de administración, iconos personalizados ni el registro de versiones.

---

## 1. Visión General y Experiencia de Usuario

### 1.1 Propósito
Convertir WeRoll en un entorno multiusuario seguro y confiable para campañas presenciales o a distancia, donde el Administrador mantiene el control de acceso, los Dungeon Masters administran sus mesas con clave privada, los Jugadores son dueños absolutos de sus fichas sin riesgo de sobreescritura accidental por terceros, y la mesa entera conoce el estado de atención de sus integrantes en tiempo real.

### 1.2 Flujos Principales de Usuario

#### A. Flujo de Registro y Aprobación
1. El usuario abre la app y hace clic en **Registrarse / Iniciar Sesión**.
2. Ingresa su correo electrónico, nombre para mostrar, contraseña y selecciona el rol al que aplica: `Jugador` o `Dungeon Master`.
3. Al enviar, la pantalla muestra un estado claro: *"Solicitud enviada. Tu cuenta está en revisión por el Administrador. Podrás acceder en cuanto sea aprobada."*
4. El Administrador accede a su panel protegido (`Ajustes de Administrador` > pestaña `Solicitudes y Usuarios`).
5. El Administrador visualiza la lista de solicitudes con fecha, correo, nombre y rol solicitado, con botones directos **Aprobar** y **Rechazar**.
6. Tras la aprobación, el usuario puede iniciar sesión inmediatamente.

#### B. Flujo del Jugador (Ficha Personal y Unión a Mesa)
1. El jugador aprobado inicia sesión con su cuenta.
2. Accede a su lista de personajes propios o crea uno nuevo. Solo él y el DM de su mesa pueden ver sus estadísticas; ningún otro jugador puede editar su ficha.
3. Para unirse a una sesión en vivo, ingresa el **Nombre de la Mesa** y la **Contraseña de la Mesa** proporcionada por su DM.
4. Al entrar, el servidor guarda automáticamente la **Copia de Sesión (Slot A o B)** de su ficha.
5. Durante la partida, su estado de actividad (Activo, Pensando, AFK) se calcula y transmite al panel de la mesa.
6. Al desconectarse o cerrar sesión, se ejecuta el guardado final de la sesión en el servidor.

#### C. Flujo del Dungeon Master (Creación de Mesa y Espacio DM)
1. El DM aprobado inicia sesión y accede al **Dungeon Master Screen**.
2. Define o actualiza los datos de su mesa: **Nombre de Campaña/Mesa** y **Contraseña de Acceso**.
3. Administra su propio archivo de campaña (bloc de notas, mapa táctico, lista de PNJs, tesoros, monstruos y compendio personalizado) sin interferir con las fichas de los jugadores.
4. En la barra de sesión en vivo, el DM ve la cuadrícula de jugadores conectados con sus puntos de golpe, CA, tiradas recientes y su indicador de presencia en tiempo real con los 4 estados de actividad.
5. El DM puede enviar mensajes en vivo a la mesa y otorgar objetos del inventario a personajes aprobados.

#### D. Flujo del Administrador (Auditoría, Respaldo y Recuperación)
1. Acceso con contraseña maestra de Administrador.
2. Gestión de usuarios (aprobar, suspender, cambiar rol, restablecer contraseñas).
3. Inspección del repositorio de copias de seguridad: historial de las últimas 2 copias rotativas por jugador, con opción de previsualizar, descargar en JSON o restaurar la ficha en caso de pérdida.
4. Gestión de versiones de la app, notas de parche y ajustes persistentes que no se reinician al publicar nuevas compilaciones.

---

## 2. Diseño Visual e Interfaz

### 2.1 Identidad Visual y Atmósfera
- **Estilo**: Fantasía oscura refinada con acentos de pergamino antiguo, runas arcanas y acabados en bronce/oro envejecido.
- **Paleta de Colores**:
  - Lienzo neutral dominante (60%): Fondos oscuros pizarra y carbón profundo (`#0b0f19`, `#111827`, `#1f2937`).
  - Superficies y contenedores (30%): Paneles con bordes tenues de 1px en ámbar/bronce apagado (`#374151`, `#451a03`/30).
  - Acentos de acción (10%): Ámbar arcano (`#d97706`, `#f59e0b`), esmeralda para estado activo (`#10b981`), zafiro místico para estado pensando (`#3b82f6`) y pizarra apagada para estado AFK (`#6b7280`).
- **Tipografía**:
  - Títulos y encabezados: `Cinzel` o `Outfit` con tracking elegante.
  - Texto de lectura y fichas: `Plus Jakarta Sans` o `Inter` con números tabulares (`tabular-nums`) para puntuaciones de dados, CA y vida.

### 2.2 Indicadores de Estado de Presencia (4 Modos de AFK)
En la barra de sesión y cuadrícula de participantes:
- **Activo** ($\le 1$ min): Insignia con texto claro `En Vivo · Activo` y resplandor sutil esmeralda.
- **Pausa** ($1-3$ min): Texto claro `Pausa reciente` en ámbar suave.
- **Pensando** ($3-10$ min): Icono de reloj de arena o mente concentrada con texto `Pensando su turno...` en tono zafiro.
- **Ausente / AFK** ($> 10$ min): Texto `Ausente (hace X min)` en gris neutro, indicando exactamente el tiempo de inactividad.

---

## 3. Arquitectura Técnica y Estrategia de Datos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENTE WEB (REACT SPA)                         │
├───────────────────────┬───────────────────────────────┬─────────────────────┤
│   Módulo Jugador      │        Módulo DM              │  Panel Admin        │
│ • Hoja personal única │ • Workspace DM independiente  │ • Aprobación de     │
│ • Unión por mesa + pw │ • Creación de mesa + pw       │   cuentas           │
│ • Monitor de actividad│ • Monitor en vivo 4-tier AFK  │ • Copias rotativas  │
│   (mouse/teclas/tiradas) • Envío de items a mesa      │ • Ajustes globales  │
└───────────┬───────────┴───────────────┬───────────────┴──────────┬──────────┘
            │                           │                          │
            ▼                           ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    API REST & EVENTOS EN SERVIDOR (NODE/EXPRESS)            │
│  /api/auth/register    /api/auth/login      /api/admin/users/approve        │
│  /api/rooms/create     /api/rooms/join      /api/heartbeat/presence         │
│  /api/backup/player    /api/backup/restore  /api/admin/settings             │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                ALMACENAMIENTO PERSISTENTE EN DISCO (JSON STORE)             │
│  • users.json        : Cuentas, roles, hash de contraseña, estado (aprobado)│
│  • rooms.json        : Mesas activas, DM propietario, hash de contraseña   │
│  • characters.json   : Fichas vinculadas por ID de usuario propietario      │
│  • dm_workspaces.json: Espacios de trabajo privados de cada DM              │
│  • backups.json      : Historial rotativo de 2 copias por jugador/sesión    │
│  • settings.json     : Clave admin, icono, versión y configuración global   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Modelo de Datos del Servidor

#### Usuario (`UserRecord`)
```typescript
interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: 'player' | 'dm' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  requestedRole: 'player' | 'dm';
  createdAt: number;
  approvedAt?: number;
  approvedBy?: string;
}
```

#### Mesa / Sala de Juego (`GameRoom`)
```typescript
interface GameRoom {
  id: string;
  name: string;
  dmUserId: string;
  dmDisplayName: string;
  passwordHash: string;
  createdAt: number;
  activePlayers: {
    userId: string;
    characterId: string;
    characterName: string;
    lastActiveAt: number;
    activityStatus: 'active' | 'idle' | 'thinking' | 'afk';
  }[];
}
```

#### Registro de Copia Rotativa (`PlayerSessionBackup`)
```typescript
interface PlayerSessionBackup {
  userId: string;
  characterId: string;
  characterName: string;
  // Exactamente 2 copias ordenadas cronológicamente (ranura previa y ranura actual)
  slots: [
    { timestamp: number; reason: 'join' | 'leave'; snapshot: Character5e } | null,
    { timestamp: number; reason: 'join' | 'leave'; snapshot: Character5e } | null
  ];
  lastRotatedAt: number;
}
```

---

## 4. Plan de Implementación por Etapas

### Fase 1: Capa de Persistencia y Endpoints de Servidor
1. Crear módulo `server/dataStore.ts` con manejo seguro de lectura/escritura atómica en disco para usuarios, mesas, fichas y copias de seguridad.
2. Implementar endpoints de autenticación: registro con estado `pending`, login solo para cuentas `approved` (o admin maestro), y endpoint para verificar sesión activa.
3. Implementar endpoints de administración: listar solicitudes pendientes, aprobar usuario, rechazar usuario, listar todos los usuarios y cambiar roles.
4. Implementar endpoints de salas: creación de mesa con contraseña por el DM, validación de contraseña al unirse, y desconexión segura.
5. Implementar endpoints de copias de seguridad rotativas: guardado de snapshot en el evento de entrada y salida, con rotación estricta de las 2 versiones más recientes.

### Fase 2: Control de Actividad y Estados AFK (Cliente y Servidor)
1. Crear hook `useUserActivity`: escucha eventos del usuario (`mousemove`, `keydown`, `touchstart`, tiradas de dados y cambios de pestañas) con acelerador (throttle) para no saturar.
2. Calcular el estado de presencia en 4 niveles:
   - $0 - 60$ s: `active`
   - $1 - 3$ min: `idle`
   - $3 - 10$ min: `thinking`
   - $> 10$ min: `afk`
3. Enviar pulso (heartbeat) periódico al servidor actualizando la presencia de jugadores y DM.
4. Renderizar en la interfaz de la mesa los indicadores visuales precisos para cada estado con tooltip de tiempo de inactividad.

### Fase 3: Seguridad de Fichas y Espacio DM
1. Vincular cada hoja de personaje al `userId` del creador. Deshabilitar edición y guardado si el usuario autenticado no es el propietario legítimo.
2. Mantener el espacio del Dungeon Master en un repositorio independiente (`dm_workspaces.json`), asegurando que solo el DM correspondiente pueda modificarlo y guardarlo.
3. Modal de unión a mesa: formulario que solicita **Nombre de Mesa** y **Contraseña de Mesa**, impidiendo el acceso a la partida sin la clave exacta.

### Fase 4: Panel de Control del Administrador y Respaldo Permanente
1. Modal del Administrador con pestañas:
   - **Solicitudes Pendientes**: Tabla interactiva con botones **Aprobar** y **Rechazar**.
   - **Copias de Seguridad (2 por Jugador)**: Visor de respaldos por jugador y sesión, permitiendo descargar el JSON o restaurar la ficha directamente en caso de emergencia.
   - **Ajustes de la Aplicación**: Cambio de contraseña de admin, personalización de nombre/icono y registro de versiones (changelog) persistente que se conserva entre publicaciones del applet.

---

## 5. Criterios de Aceptación y Pruebas

- [ ] Un usuario registrado como Jugador o DM no puede acceder a las funciones hasta que el Administrador presione **Aprobar** en el panel.
- [ ] Un jugador no puede editar ni sobreescribir la ficha de otro jugador.
- [ ] El DM puede crear su mesa con contraseña y los jugadores solo pueden entrar si la contraseña coincide.
- [ ] El servidor almacena exactamente las 2 últimas versiones de sesión por jugador y sobreescribe la más antigua en la tercera sesión.
- [ ] La barra de presencia refleja fielmente los 4 estados de actividad (Activo, Pausa, Pensando, AFK) tanto para jugadores como para el DM.
- [ ] Las configuraciones del administrador y las versiones permanecen intactas en el servidor tras reiniciar o actualizar la app.
