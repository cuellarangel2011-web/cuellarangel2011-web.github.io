import express from 'express';
import { GoogleGenAI } from '@google/genai';
import type { DiceRollResult, PartyMemberLive } from '../types/dnd.ts';

export const apiRouter = express.Router();

// Memory store for multiplayer sessions / rooms
interface RoomState {
  roomCode: string;
  createdAt: number;
  lastUpdated: number;
  party: Record<string, PartyMemberLive>;
  dmConnected?: boolean;
  dmLastPing?: number;
  dmLiveMessage?: string;
  dmLastRoll?: DiceRollResult;
  rollFeed: DiceRollResult[];
  dmAnnouncements: {
    id: string;
    title: string;
    content: string;
    timestamp: number;
  }[];
  currentQuest?: string;
  quickNotification?: string;
}

const rooms: Record<string, RoomState> = {};

function getOrCreateRoom(code: string): RoomState {
  const normCode = code.trim().toUpperCase() || 'MESA-PRINCIPAL';
  if (!rooms[normCode]) {
    rooms[normCode] = {
      roomCode: normCode,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      party: {},
      dmConnected: false,
      dmLastPing: 0,
      dmLiveMessage: '',
      rollFeed: [],
      dmAnnouncements: [],
      currentQuest: 'Investigar los misterios del reino y proteger a los inocentes.',
      quickNotification: '',
    };
  }
  return rooms[normCode];
}

// Clean old sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of Object.entries(rooms)) {
    if (now - room.lastUpdated > 24 * 60 * 60 * 1000) {
      delete rooms[code];
    }
  }
}, 60 * 60 * 1000);

// Initialize Gemini Client (checks host override header or process.env.GEMINI_API_KEY)
function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Health endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// 2. Room State Sync (Get full room status)
apiRouter.get('/session/room/:roomCode', (req, res) => {
  const room = getOrCreateRoom(req.params.roomCode);
  const now = Date.now();

  // Prune inactive players (idle > 10 min)
  const activeParty = Object.values(room.party).filter(
    (p) => now - p.lastPing < 10 * 60 * 1000
  );

  const dmActive = Boolean(room.dmConnected && (now - (room.dmLastPing || 0) < 15 * 60 * 1000));

  res.json({
    roomCode: room.roomCode,
    party: activeParty,
    dmConnected: dmActive,
    dmLiveMessage: room.dmLiveMessage || '',
    dmLastRoll: room.dmLastRoll,
    rollFeed: room.rollFeed.slice(-30),
    dmAnnouncements: room.dmAnnouncements.slice(-10),
    currentQuest: room.currentQuest,
    quickNotification: room.quickNotification,
  });
});

// 2b. Post DM Heartbeat & Live Message
apiRouter.post('/session/room/:roomCode/dm-heartbeat', (req, res) => {
  const room = getOrCreateRoom(req.params.roomCode);
  const { dmLiveMessage, dmConnected = true } = req.body;

  room.dmConnected = dmConnected;
  room.dmLastPing = Date.now();
  if (dmLiveMessage !== undefined) {
    room.dmLiveMessage = dmLiveMessage;
  }
  room.lastUpdated = Date.now();
  res.json({ success: true, dmLiveMessage: room.dmLiveMessage });
});

// 3. Post Player Heartbeat / Update
apiRouter.post('/session/room/:roomCode/heartbeat', (req, res) => {
  const room = getOrCreateRoom(req.params.roomCode);
  const { characterId, characterName, playerName, currentHp, maxHp, ac, passivePerception, level, characterClass, lastRoll } = req.body;

  if (characterId) {
    const existing = room.party[characterId];
    room.party[characterId] = {
      characterId,
      characterName: characterName || 'Aventurero',
      playerName: playerName || 'Jugador',
      currentHp: Number(currentHp) || 0,
      maxHp: Number(maxHp) || 10,
      ac: Number(ac) || 10,
      passivePerception: Number(passivePerception) || 10,
      level: Number(level) || 1,
      characterClass: characterClass || 'Aventurero',
      lastPing: Date.now(),
      lastRoll: lastRoll || existing?.lastRoll,
    };
    room.lastUpdated = Date.now();
  }

  res.json({ success: true });
});

// 4. Post Roll to Room Feed & Store Last Roll per member / DM
apiRouter.post('/session/room/:roomCode/roll', (req, res) => {
  const room = getOrCreateRoom(req.params.roomCode);
  const rollData: DiceRollResult = req.body;
  const { characterId, isDm } = req.query;

  if (rollData && rollData.rollerName) {
    const formattedRoll = {
      ...rollData,
      id: rollData.id || `roll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    room.rollFeed.push(formattedRoll);

    if (isDm === 'true' || rollData.rollerName.toLowerCase().includes('dungeon master') || rollData.rollerName.toLowerCase() === 'dm') {
      room.dmLastRoll = formattedRoll;
    } else if (characterId && room.party[characterId as string]) {
      room.party[characterId as string].lastRoll = formattedRoll;
    }

    if (room.rollFeed.length > 50) {
      room.rollFeed.shift();
    }
    room.lastUpdated = Date.now();
  }

  res.json({ success: true, count: room.rollFeed.length });
});

// 5. Post DM Announcements, Current Quest, and Quick Notification
apiRouter.post('/session/room/:roomCode/announce', (req, res) => {
  const room = getOrCreateRoom(req.params.roomCode);
  const { title, content, quest, notification } = req.body;

  if (quest !== undefined) {
    room.currentQuest = quest;
  }
  if (notification !== undefined) {
    room.quickNotification = notification;
  }

  if (content) {
    room.dmAnnouncements.push({
      id: `ann-${Date.now()}`,
      title: title || 'Aviso del Dungeon Master',
      content,
      timestamp: Date.now(),
    });
    if (room.dmAnnouncements.length > 20) {
      room.dmAnnouncements.shift();
    }
  }

  room.lastUpdated = Date.now();
  res.json({ success: true, quest: room.currentQuest, notification: room.quickNotification });
});

// 6. El Sabio Arcano Chat (Player & DM)
apiRouter.post('/gemini/chat', async (req, res) => {
  const { prompt, characterContext, dmContext, isDm, model } = req.body;
  const customKey = req.headers['x-gemini-api-key'] as string;

  if (!prompt) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  const ai = getGeminiClient(customKey);

  if (!ai) {
    const offlineAnswer = generateOfflineAssistantResponse(prompt, characterContext, dmContext, isDm);
    return res.json({ text: offlineAnswer, isOffline: true });
  }

  try {
    let systemInstruction = `Eres "El Sabio Arcano", una entidad venerable, sabia y paciente que actúa como árbitro maestro del juego de rol Dungeons & Dragons 5ª Edición (SRD 5E) para jugadores de habla hispana.
NORMAS ESTRICTAS:
1. NUNCA menciones que eres una IA, un modelo de lenguaje o Gemini. Preséntate siempre como "El Sabio Arcano".
2. Conoces a la perfección las reglas oficiales de 5E: acciones en combate, estados (cegado, paralizado, etc.), coberturas, espacios de conjuro, ataques de oportunidad, etc.
3. Si el jugador pregunta sobre su inventario, características o acciones, revisa su contexto.
4. Si el Dungeon Master te consulta, eres su consejero confidencial de campaña: conoces sus PNJs, monstruos, lugares y secretos y puedes ayudarle a improvisar trampas, equilibrar combates y desarrollar la trama.
5. Responde con calidez, sabiduría arcana, formato claro y viñetas cuando sea pedagógico.`;


    let contextSnippet = '';
    if (characterContext) {
      contextSnippet += `\n\n[Ficha del Personaje que consulta]
Nombre: ${characterContext.name || 'Sin nombre'} (${characterContext.race || ''} ${characterContext.characterClass || ''} Nivel ${characterContext.level || 1})
PG: ${characterContext.currentHp}/${characterContext.maxHp} | CA: ${characterContext.armorClass || 10} | Inic: ${characterContext.initiativeBonus || 0}
FUE: ${characterContext.abilities?.str?.score || 10}, DES: ${characterContext.abilities?.dex?.score || 10}, CON: ${characterContext.abilities?.con?.score || 10}, INT: ${characterContext.abilities?.int?.score || 10}, SAB: ${characterContext.abilities?.wis?.score || 10}, CAR: ${characterContext.abilities?.cha?.score || 10}
Inventario: ${(characterContext.inventory || []).map((i: any) => `${i.name} (x${i.quantity || 1}${i.equipped ? ', Equipado' : ''})`).join(', ') || 'Vacío'}
Monedas: ${characterContext.currency?.gp || 0} PO, ${characterContext.currency?.sp || 0} PP, ${characterContext.currency?.cp || 0} PC
Ataques: ${(characterContext.attacks || []).map((a: any) => `${a.name} (+${a.attackBonus}, ${a.damageDice} ${a.damageType})`).join('; ') || 'Ninguno'}
Rasgos: ${(characterContext.featuresAndTraits || []).map((f: any) => f.name).join(', ') || 'Ninguno'}`;
    }

    if (dmContext) {
      contextSnippet += `\n\n[ARCHIVO CONFIDENCIAL DE CAMPAÑA DEL DUNGEON MASTER]
Campaña: ${dmContext.campaignTitle || 'Aventura Principal'}
Misión / Objetivo Activo: ${dmContext.currentQuest || 'Sin misión fijada'}

NPCs Registrados (${(dmContext.npcs || []).length}):
${(dmContext.npcs || []).map((n: any) => `• ${n.name} (${n.race} ${n.occupation}, Actitud: ${n.attitude}, Carpeta: ${n.folder || 'General'}). Ubicación: ${n.location}. Secreto DM: ${n.secretOrHook || 'Ninguno'}. Notas: ${n.notes || 'Sin notas'}. Evolución: ${n.evolution || 'Sin cambios recientes'}`).join('\n')}

Monstruos y Criaturas (${(dmContext.monsters || []).length}):
${(dmContext.monsters || []).map((m: any) => `• ${m.name} (CR ${m.cr}, CA ${m.ac}, PG ${m.hp}/${m.maxHp}, ${m.size} ${m.type}). Ataques: ${(m.actions || []).map((a: any) => `${a.name} (+${a.toHit}, ${a.damage} ${a.damageType})`).join(', ')}. Notas: ${m.notes || 'Ninguna'}`).join('\n')}

Lugares, Mazmorras y Mapas (${(dmContext.locations || []).length}):
${(dmContext.locations || []).map((l: any) => `• ${l.name} (${l.type}, Región: ${l.region || 'Desconocida'}). Puntos clave: ${(l.pointsOfInterest || []).join(', ') || 'Sin puntos'}. Secretos DM: ${l.secretsForDm || 'Ninguno'}. Notas tácticas: ${l.notes || 'Sin notas'}. Evolución: ${l.evolution || 'Sin cambios'}`).join('\n')}

Diario de Sesiones y Crónicas (${(dmContext.campaignLogs || []).length}):
${(dmContext.campaignLogs || []).map((log: any) => `• Sesión ${log.sessionNumber}: "${log.title}" (${log.date}). Resumen: ${log.summary}. Público: ${log.publicNotes || 'N/A'}. Notas Secretas DM: ${log.privateNotes || 'N/A'}`).join('\n')}

Resúmenes de Combates Anteriores (${(dmContext.combatSummaries || []).length}):
${(dmContext.combatSummaries || []).map((cs: any) => `• "${cs.name}" (${cs.date}, ${cs.roundsCount} rondas). Participantes: ${(cs.participants || []).join(', ')}. Notas del DM: ${cs.notes || 'Sin notas'}`).join('\n')}`;
    }

    const fullPrompt = `${contextSnippet ? contextSnippet + '\n\n' : ''}Consulta: ${prompt}`;

    const response = await ai.models.generateContent({
      model: model || 'gemini-3.8-flash',
      contents: fullPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text || 'Las energías arcanas permanecen en silencio.' });
  } catch (error: any) {
    console.error('Error in chat:', error);
    const offlineAnswer = generateOfflineAssistantResponse(prompt, characterContext, dmContext, isDm);
    res.json({
      text: `${offlineAnswer}\n\n*(Respuesta consultada mediante el Compendio Arcano)*`,
      isOffline: true,
    });
  }
});

// 7. AI Co-Pilot NPC Generator / Assist
apiRouter.post('/gemini/generate-npc', async (req, res) => {
  const { name, race, occupation, location, attitude, theme } = req.body;
  const customKey = req.headers['x-gemini-api-key'] as string;
  const ai = getGeminiClient(customKey);

  if (!ai) {
    return res.json({
      name: name || 'Torvin Barbaferro',
      race: race || 'Enano de las Colinas',
      occupation: occupation || 'Herrero de armas rúnicas',
      attitude: attitude || 'Neutral',
      location: location || 'Plaza de los Yunque',
      appearance: 'Brazos anchos como robles, delantal de cuero cubierto de hollín y ojos astutos.',
      personality: 'Orgulloso de su forja, desconfía de la magia débil pero respeta el acero auténtico.',
      secretOrHook: 'Encontró un trozo de meteorito estrellado en la mina norte que murmura al ser golpeado.',
      notes: 'Tiene amistad con el tabernero local.',
      evolution: 'Dispuesto a fabricar armas con descuento si le traen carbón especial.',
      stats: { hp: 35, ac: 14, cr: '1', notes: 'Martillo de guerra +4 (1d8+2)' },
    });
  }

  try {
    const prompt = `Actúa como co-piloto del Dungeon Master de D&D 5E.
Completa o genera los detalles faltantes para este PNJ (NPC) en formato JSON válido.
Datos proporcionados por el DM (mantén estos datos y complementa los vacíos):
- Nombre: ${name || 'Generar uno evocador'}
- Raza: ${race || 'Generar una acorde'}
- Oficio/Rol: ${occupation || 'Generar un rol interesante'}
- Ubicación: ${location || 'Generar ubicación adecuada'}
- Actitud: ${attitude || 'Neutral'}
- Tema/Ambiente: ${theme || 'Fantasía medieval estándar'}

Formato JSON estricto:
{
  "name": "Nombre completo",
  "race": "Raza",
  "occupation": "Rol o profesión",
  "attitude": "Aliado" | "Amistoso" | "Neutral" | "Desconfiado" | "Hostil",
  "location": "Lugar exacto",
  "appearance": "Descripción física distintiva (2 frases)",
  "personality": "Manera de hablar y comportamiento",
  "secretOrHook": "Secreto para el DM o gancho de aventura",
  "notes": "Notas privadas breves del DM",
  "evolution": "Posible desarrollo o cambios durante la campaña",
  "stats": { "hp": 30, "ac": 13, "cr": "1/2", "notes": "Notas rápidas de combate" }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al generar NPC con IA' });
  }
});

// 8. AI Co-Pilot Monster Generator / Assist
apiRouter.post('/gemini/generate-monster', async (req, res) => {
  const { name, cr, type, environment } = req.body;
  const customKey = req.headers['x-gemini-api-key'] as string;
  const ai = getGeminiClient(customKey);

  if (!ai) {
    return res.json({
      name: name || ' acechador de las Criptas',
      size: 'Mediano',
      type: type || 'Muerto viviente',
      alignment: 'Neutral Maligno',
      cr: cr || '2',
      ac: 14,
      hp: 45,
      maxHp: 45,
      speed: '30 pies, trepar 30 pies',
      str: 14,
      dex: 16,
      con: 14,
      int: 8,
      wis: 12,
      cha: 6,
      traits: [{ name: 'Salto Emboscador', description: 'Si salta al menos 15 pies hacia una criatura, tiene ventaja en el ataque.' }],
      actions: [
        { id: 'ma-1', name: 'Garras Venenosas', type: 'melee', toHit: 5, damage: '2d6+3', damageType: 'Cortante + 1d6 Veneno', description: 'Ataque cuerpo a cuerpo' },
        { id: 'ma-2', name: 'Alarido Aterrador (Recarga 6)', type: 'ranged', toHit: 0, damage: '2d8', damageType: 'Psíquico', description: 'Salvación SAB CD 12 o Asustado por 1 min.' },
      ],
      notes: 'Evita la luz solar directa.',
    });
  }

  try {
    const prompt = `Actúa como diseñador de monstruos para el Dungeon Master de D&D 5E.
Completa o genera las estadísticas completas de este monstruo en formato JSON.
Datos del DM:
- Nombre: ${name || 'Monstruo original'}
- Desafío (CR deseado): ${cr || '2'}
- Tipo de criatura: ${type || 'Monstruosidad o Muerto viviente'}
- Entorno: ${environment || 'Mazmorra oscura'}

Estructura requerida en JSON:
{
  "name": "Nombre",
  "size": "Mediano" | "Grande" | "Pequeño" | "Enorme",
  "type": "Tipo de criatura",
  "alignment": "Alineamiento",
  "cr": "1" | "2" | "3" | etc.,
  "ac": 14,
  "hp": 45,
  "maxHp": 45,
  "speed": "30 pies",
  "str": 14, "dex": 14, "con": 14, "int": 10, "wis": 10, "cha": 8,
  "traits": [ { "name": "Rasgo", "description": "Efecto" } ],
  "actions": [
    { "id": "ma-1", "name": "Ataque 1", "type": "melee", "toHit": 5, "damage": "1d8+3", "damageType": "Cortante", "description": "Detalle" },
    { "id": "ma-2", "name": "Ataque 2", "type": "ranged", "toHit": 4, "damage": "1d6+2", "damageType": "Perforante", "description": "Detalle" }
  ],
  "notes": "Estrategia para el DM"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al generar monstruo con IA' });
  }
});

// 9. AI Co-Pilot Location Generator / Assist
apiRouter.post('/gemini/generate-location', async (req, res) => {
  const { name, type, region, theme } = req.body;
  const customKey = req.headers['x-gemini-api-key'] as string;
  const ai = getGeminiClient(customKey);

  if (!ai) {
    return res.json({
      name: name || 'Criptas de la Lanza Helada',
      type: type || 'Mazmorra',
      region: region || 'Paso de la Ventisca',
      description: 'Antiguo complejo funerario tallado en roca helada donde estalactitas gotean sobre ataúdes olvidados.',
      secretsForDm: 'Una palanca oculta tras el altar descongela el mecanismo de la puerta hacia la cámara del tesoro.',
      notes: 'Peligro ambiental: frío extremo (-10°C). Cada hora requiere salvación de CON CD 10.',
      evolution: 'Si los aventureros rompen el cristal de escarcha, el hielo de toda la cueva empezará a derretirse.',
      pointsOfInterest: ['La Galería de las Estatuas Congeladas', 'El Pozo de Hielo Negro', 'El Sepulcro del General'],
    });
  }

  try {
    const prompt = `Crea o complementa un lugar de D&D 5E para el Dungeon Master en formato JSON válido.
Datos del DM:
- Nombre: ${name || 'Generar nombre sugerente'}
- Tipo: ${type || 'Mazmorra, Taberna o Villa'}
- Región: ${region || 'Tierras salvajes'}
- Tema/Ambiente: ${theme || 'Misterio y peligro'}

Formato JSON:
{
  "name": "Nombre",
  "type": "Ciudad" | "Mazmorra" | "Templo" | "Bosque" | "Castillo" | "Taberna" | "Ruinas" | "Poblado",
  "region": "Región",
  "description": "Descripción sensorial para leer a los jugadores",
  "secretsForDm": "Secretos, trampas ocultas y tesoros para el DM",
  "notes": "Notas tácticas y peligros ambientales",
  "evolution": "Cómo puede cambiar o reaccionar este lugar según lo que hagan los personajes",
  "pointsOfInterest": ["Punto clave 1", "Punto clave 2", "Punto clave 3"]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al generar lugar con IA' });
  }
});

// Offline assistant fallback
function generateOfflineAssistantResponse(query: string, characterContext?: any, dmContext?: any, isDm?: boolean): string {
  const q = query.toLowerCase();

  if (characterContext && (q.includes('tengo') || q.includes('objeto') || q.includes('mochila') || q.includes('inventario') || q.includes('armadura') || q.includes('arma'))) {
    const items = (characterContext.inventory || []).map((i: any) => `• ${i.name} (x${i.quantity || 1}${i.equipped ? ' - Equipado' : ''})`).join('\n');
    return `📦 **Inventario de ${characterContext.name || 'tu personaje'}:**\n\n${items || 'No tienes objetos registrados en tu hoja actualmente.'}\n\nMonedero: ${characterContext.currency?.gp || 0} PO (Oro), ${characterContext.currency?.sp || 0} PP (Plata), ${characterContext.currency?.cp || 0} PC (Cobre).`;
  }

  if (isDm && dmContext) {
    if (q.includes('npc') || q.includes('pnj') || q.includes('personaje')) {
      const npcs = (dmContext.npcs || []).map((n: any) => `• **${n.name}** (${n.race} ${n.occupation}, ${n.attitude}): ${n.location}. Secreto: "${n.secretOrHook || 'Sin secreto'}". Evolución: ${n.evolution || 'Sin cambios'}`).join('\n');
      return `👥 **NPCs Registrados en la Campaña:**\n\n${npcs || 'No tienes NPCs registrados aún en tus carpetas.'}`;
    }

    if (q.includes('lugar') || q.includes('mazmorra') || q.includes('mapa') || q.includes('ciudad') || q.includes('villa')) {
      const locs = (dmContext.locations || []).map((l: any) => `• **${l.name}** (${l.type}, Región: ${l.region || 'Desconocida'}): ${l.description.slice(0, 100)}... Secreto: "${l.secretsForDm || 'Ninguno'}"`).join('\n');
      return `🗺️ **Lugares y Mazmorras Registrados:**\n\n${locs || 'No hay lugares guardados en tu archivero.'}`;
    }

    if (q.includes('monstruo') || q.includes('enemigo') || q.includes('bestia')) {
      const mons = (dmContext.monsters || []).map((m: any) => `• **${m.name}** (CR ${m.cr}, CA ${m.ac}, PG ${m.hp}/${m.maxHp}) - Ataques: ${(m.actions || []).map((a: any) => a.name).join(', ') || 'Ataque básico'}`).join('\n');
      return `💀 **Bestiario y Monstruos de la Campaña:**\n\n${mons || 'No hay monstruos registrados actualmente.'}`;
    }

    if (q.includes('combate') || q.includes('resumen') || q.includes('pelea')) {
      const sums = (dmContext.combatSummaries || []).map((s: any) => `• **${s.name}** (${s.date}, ${s.roundsCount} rondas): Participantes: ${(s.participants || []).join(', ')}. Resumen DM: "${s.notes || 'Sin notas'}"`).join('\n');
      return `⚔️ **Resúmenes de Combates Archivados:**\n\n${sums || 'Aún no has archivado ningún combate finalizado.'}`;
    }

    if (q.includes('diario') || q.includes('cronica') || q.includes('crónica') || q.includes('sesion') || q.includes('sesión')) {
      const logs = (dmContext.campaignLogs || []).map((l: any) => `• **Sesión ${l.sessionNumber}: ${l.title}** (${l.date}): ${l.summary}`).join('\n');
      return `📖 **Diario de Campaña:**\n\n${logs || 'No hay entradas en la crónica de campaña.'}`;
    }
  }

  if (q.includes('ataque de oportunidad') || q.includes('oportunidad')) {
    return `⚔️ **Ataque de Oportunidad (D&D 5E):**\n\n• Se desencadena cuando una criatura hostil que puedes ver sale voluntariamente de tu alcance cuerpo a cuerpo (generalmente 5 pies).\n• Consume tu **Reacción** de la ronda.\n• Realizas un único ataque con arma cuerpo a cuerpo justo antes de que la criatura abandone tu alcance.\n• *Excepción:* No provoca ataque de oportunidad si la criatura realiza la acción de **Destrabarse (Disengage)** o si es movida a la fuerza (por ejemplo, empujada).`;
  }

  if (q.includes('dos conjuros') || q.includes('lanzar 2') || q.includes('accion adicional') || q.includes('bonus action')) {
    return `✨ **Lanzar Conjuros con Acción Adicional:**\n\n• Si lanzas un conjuro con tiempo de lanzamiento de **Acción Adicional** (como *Palabra de Curación* o *Paso Brumoso*), durante ese mismo turno **no puedes lanzar ningún otro conjuro**, excepto un **Truco (Cantrip)** con tiempo de lanzamiento de 1 Acción.\n• No puedes lanzar dos conjuros de nivel 1 o superior en el mismo turno a menos que uses *Oleada de Acción (Action Surge)* de Guerrero.`;
  }

  if (q.includes('concentracion') || q.includes('concentración')) {
    return `🧠 **Reglas de Concentración:**\n\n• Solo puedes mantener la concentración en **un solo conjuro a la vez**.\n• Si recibes daño mientras te concentras, debes hacer una tirada de salvación de **Constitución**.\n• La CD es igual a **10 o la mitad del daño recibido** (el número que sea mayor).\n• Si recibes daño de múltiples fuentes, tiras por cada una por separado.\n• Quedar Incapacitado o Muerto rompe la concentración automáticamente.`;
  }

  if (q.includes('descanso') || q.includes('dormir') || q.includes('curar')) {
    return `🏕️ **Descansos en 5E:**\n\n• **Descanso Corto (Short Rest):** Al menos 1 hora de reposo ligero. Puedes gastar Dados de Golpe para curarte (Dado + tu mod de Constitución por cada dado gastado).\n• **Descanso Largo (Long Rest):** 8 horas (al menos 6 de sueño). Recuperas todos tus Puntos de Golpe perdidos y hasta la mitad de tus Dados de Golpe máximos. Solo puedes beneficiarte de un descanso largo cada 24 horas.`;
  }

  return `📜 **El Sabio Arcano:**\n\nHas consultado sobre: "${query}".\n\nEn las reglas de D&D 5E:\n• **Tiradas de D20:** 1d20 + Modificador de Característica + Bonificador de Competencia (si eres competente).\n• **Ventaja/Desventaja:** Tiras 2 dados d20 y te quedas con el más alto (Ventaja) o con el más bajo (Desventaja).\n• **Regla de Oro:** El Dungeon Master siempre tiene la última palabra para adaptar las reglas al ritmo de la historia.\n\nPuedes consultarme sobre reglas de combate, estados alterados, el inventario de tu personaje o pedir consejo al DM.`;
}
