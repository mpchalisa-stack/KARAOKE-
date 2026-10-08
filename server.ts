// Disable HMR in AI Studio environment as required by runtime environment guidelines
process.env.DISABLE_HMR = 'true';

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ytSearch from 'yt-search';
import os from 'os';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ConnectedClient {
  id: string;
  name: string;
  role: 'master' | 'client';
  ws?: WebSocket;
  sseRes?: express.Response;
  connectedAt: number;
  lastSeen?: number;
}

interface RoomState {
  roomId: string;
  currentSong: any | null;
  isPlaying: boolean;
  queue: any[];
  history: any[];
  clients: Map<string, ConnectedClient>;
  lastUpdated: number;
  musicDelayMs: number;
}

// In-memory room repository
const rooms = new Map<string, RoomState>();

function getOrCreateRoom(roomId: string): RoomState {
  const cleanId = (roomId || '').trim().toUpperCase() || 'DEFAULT-ROOM';
  let room = rooms.get(cleanId);
  if (!room) {
    room = {
      roomId: cleanId,
      currentSong: {
        id: 'BnlzOzdP8Is',
        title: 'Naff - Kenanglah Aku (Karaoke Version)',
        channelTitle: 'Capleo Music',
        thumbnailUrl: 'https://img.youtube.com/vi/BnlzOzdP8Is/hqdefault.jpg',
        duration: '4:10',
        isCurated: true,
      },
      isPlaying: false,
      queue: [
        {
          queueId: 'q-initial-1',
          song: {
            id: 'yyBA_2Gv3RA',
            title: 'Cakra Khan - Kekasih Bayangan (Karaoke Version)',
            channelTitle: 'Capleo Music',
            thumbnailUrl: 'https://img.youtube.com/vi/yyBA_2Gv3RA/hqdefault.jpg',
            duration: '4:53',
            isCurated: true,
          },
          singerName: 'Budi Vokal',
          addedAt: Date.now(),
        },
        {
          queueId: 'q-initial-2',
          song: {
            id: '7smwlWzip0k',
            title: 'Kerispatih - Demi Cinta (Karaoke Version)',
            channelTitle: 'Capleo Music',
            thumbnailUrl: 'https://img.youtube.com/vi/7smwlWzip0k/hqdefault.jpg',
            duration: '5:02',
            isCurated: true,
          },
          singerName: 'Siti Karaoke',
          addedAt: Date.now() + 1000,
        },
        {
          queueId: 'q-initial-3',
          song: {
            id: 'tljYFLQupq8',
            title: 'Ada Band - Manusia Bodoh (Karaoke Version)',
            channelTitle: 'Capleo Music',
            thumbnailUrl: 'https://img.youtube.com/vi/tljYFLQupq8/hqdefault.jpg',
            duration: '4:33',
            isCurated: true,
          },
          singerName: 'Rian Akustik',
          addedAt: Date.now() + 2000,
        },
        {
          queueId: 'q-initial-4',
          song: {
            id: 'bP_idWQ60bc',
            title: 'Java Jive - Gerangan Cinta (Official Karaoke Video No Vocal)',
            channelTitle: 'Musica Karaoke',
            thumbnailUrl: 'https://img.youtube.com/vi/bP_idWQ60bc/hqdefault.jpg',
            duration: '5:31',
            isCurated: true,
          },
          singerName: 'Letnan Dedi',
          addedAt: Date.now() + 3000,
        },
      ],
      history: [],
      clients: new Map(),
      lastUpdated: Date.now(),
      musicDelayMs: 70,
    };
    rooms.set(cleanId, room);
  }
  return room;
}

function broadcastToRoom(room: RoomState, message: any, excludeWs?: WebSocket) {
  const payloadStr = JSON.stringify(message);

  room.clients.forEach((client) => {
    // 1. WebSocket broadcast
    if (client.ws && client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payloadStr);
      } catch (err) {
        console.warn('WS broadcast error:', err);
      }
    }

    // 2. SSE broadcast
    if (client.sseRes) {
      try {
        client.sseRes.write(`data: ${payloadStr}\n\n`);
      } catch (err) {
        console.warn('SSE broadcast error:', err);
      }
    }
  });
}

function getRoomClientSummaries(room: RoomState) {
  const list: { id: string; name: string; role: 'master' | 'client' }[] = [];
  room.clients.forEach((c) => {
    list.push({ id: c.id, name: c.name, role: c.role });
  });
  return list;
}

async function startServer() {
  const app = express();
  const PORT = (() => {
    const portArgIndex = process.argv.indexOf('--port');
    if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
      const p = parseInt(process.argv[portArgIndex + 1], 10);
      if (!isNaN(p)) return p;
    }
    // AI Studio containers run Nginx on port 8080 which reverse-proxies to port 3000.
    // If process.env.PORT is 8080, binding directly to 8080 causes EADDRINUSE with Nginx.
    // Therefore, always listen on 3000 unless an alternate non-8080 port is explicitly specified.
    if (process.env.PORT && process.env.PORT !== '8080') {
      const p = parseInt(process.env.PORT, 10);
      if (!isNaN(p)) return p;
    }
    return 3000;
  })();
  const isProduction = process.env.NODE_ENV === 'production';

  // Support proxies across all Cloud Run regions and CDNs
  app.set('trust proxy', true);

  // Cross-Origin Resource Sharing (CORS) for all regions, origins and devices
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Universal Network & Host Info endpoint for cross-region and all-device barcode connectivity
  app.get('/api/network-info', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${PORT}`;
    const detectedUrl = `${proto}://${host}`;

    const networkInterfaces = os.networkInterfaces();
    const localIps: string[] = [];
    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          localIps.push(net.address);
        }
      }
    }

    const publicUrl = process.env.APP_URL || detectedUrl;
    const sharedUrl = publicUrl.includes('ais-dev-')
      ? publicUrl.replace('ais-dev-', 'ais-pre-')
      : publicUrl;

    res.json({
      success: true,
      detectedUrl: publicUrl,
      sharedUrl,
      rawDetectedUrl: detectedUrl,
      localIps,
      port: PORT,
      region: process.env.CLOUD_RUN_REGION || process.env.REGION || 'asia-southeast1',
      isCloudRun: !!process.env.K_SERVICE || !!process.env.APP_URL,
    });
  });

  // Server-side search route (Uses server env YOUTUBE_API_KEY if configured, or scraper engine)
  app.get('/api/search', async (req, res) => {
    try {
      const query = (req.query.q as string || '').trim();
      if (!query) {
        return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
      }

      // If server environment has YOUTUBE_API_KEY, use official API securely server-side
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (apiKey) {
        try {
          const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=24&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${apiKey}`;
          const ytRes = await fetch(ytUrl);
          if (ytRes.ok) {
            const data: any = await ytRes.json();
            if (data.items && data.items.length > 0) {
              const videos = data.items.map((item: any) => ({
                id: item.id.videoId,
                title: item.snippet?.title || '',
                channelTitle: item.snippet?.channelTitle || 'YouTube',
                thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`,
                duration: '',
                publishedAt: item.snippet?.publishedAt || '',
                isCurated: false,
              }));
              return res.json({
                success: true,
                source: 'official-api-proxy',
                query,
                count: videos.length,
                songs: videos,
              });
            }
          }
        } catch (apiErr) {
          console.warn('Server-side YouTube API error, falling back to scraper:', apiErr);
        }
      }

      const r = await ytSearch(query);
      const videos = (r.videos || []).slice(0, 24).map((v) => ({
        id: v.videoId,
        title: v.title,
        channelTitle: v.author?.name || 'YouTube',
        thumbnailUrl: v.thumbnail || v.image || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
        duration: v.timestamp || '',
        publishedAt: v.ago || '',
        views: v.views,
        isCurated: false,
      }));

      return res.json({
        success: true,
        source: 'no-api-key-engine',
        query,
        count: videos.length,
        songs: videos,
      });
    } catch (err: any) {
      console.error('Search error in /api/search:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Gagal mencari video dari YouTube',
        songs: [],
      });
    }
  });

  // Server-side Gemini AI song recommendations & military karaoke cheer
  app.post('/api/ai/cheer', async (req, res) => {
    try {
      const { songTitle, singerName, score } = req.body || {};
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          success: true,
          cheer: `Prajurit ${singerName || 'TNI AU'} membakar panggung dengan lagu "${songTitle || 'favorit'}"! Pantang mundur walau suara hancur! Komando!`,
        });
      }

      const ai = new GoogleGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Berikan komentar karaoke gaya militer TNI AU / Diskomlekau yang seru, kocak, dan membakar semangat (maksimal 2 kalimat) untuk prajurit bernama "${singerName || 'Prajurit'}" yang baru saja menyanyikan lagu "${songTitle || 'lagu'}" dengan skor karaoke ${score || 85}/100. Slogan: "Prajurit yang pantang mundur walau suara hancur".`,
      });

      return res.json({
        success: true,
        cheer: response.text?.trim() || 'Luar biasa! Prajurit sejati pantang mundur walau suara hancur!',
      });
    } catch (err: any) {
      console.warn('Gemini AI cheer error:', err);
      return res.json({
        success: true,
        cheer: 'Prajurit sejati pantang mundur walau suara hancur! Luar biasa!',
      });
    }
  });

  app.get('/api/ai/recommendations', async (req, res) => {
    try {
      const genre = (req.query.genre as string) || 'Slow Rock & Reggae';
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          success: true,
          recommendations: [
            'Scorpions - Wind Of Change',
            'Bon Jovi - Bed Of Roses',
            'Bob Marley - Could You Be Loved',
            'Dewa 19 - Kangen',
          ],
        });
      }

      const ai = new GoogleGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Sebutkan 5 judul lagu karaoke populer untuk genre "${genre}". Kembalikan hanya daftar judul lagu dan artis (satu per baris, tanpa nomor).`,
      });

      const lines = (response.text || '')
        .split('\n')
        .map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 5);

      return res.json({
        success: true,
        recommendations: lines,
      });
    } catch (err: any) {
      return res.json({
        success: true,
        recommendations: [
          'Scorpions - Wind Of Change',
          'Bon Jovi - Bed Of Roses',
          'Bob Marley - Could You Be Loved',
        ],
      });
    }
  });

  // Resolve video info by ID without API key
  app.get('/api/resolve-video', async (req, res) => {
    try {
      const videoId = (req.query.id as string || '').trim();
      if (!videoId) {
        return res.status(400).json({ error: 'Parameter "id" is required' });
      }

      const r = await ytSearch({ videoId });
      if (r) {
        return res.json({
          success: true,
          song: {
            id: r.videoId,
            title: r.title,
            channelTitle: r.author?.name || 'YouTube',
            thumbnailUrl: r.thumbnail || `https://img.youtube.com/vi/${r.videoId}/hqdefault.jpg`,
            duration: r.timestamp || '',
            publishedAt: r.ago || '',
          },
        });
      }

      return res.status(404).json({ error: 'Video tidak ditemukan' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Shortcut routes so users never get "page not found" on manual URL typing
  app.get(['/client', '/remote', '/hp'], (req, res) => {
    const room = req.query.room ? `&room=${encodeURIComponent(req.query.room as string)}` : '';
    res.redirect(`/?client=1${room}`);
  });

  app.get(['/tv', '/stage', '/panggung'], (req, res) => {
    const room = req.query.room ? `&room=${encodeURIComponent(req.query.room as string)}` : '';
    res.redirect(`/?mode=tv${room}`);
  });

  // --- ROOM STATE & SYNC API FOR ANDROID CLIENTS & MASTER ---

  // Get current room state
  app.get('/api/room/:roomId', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    res.json({
      success: true,
      room: {
        roomId: room.roomId,
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        queue: room.queue,
        musicDelayMs: room.musicDelayMs ?? 70,
        clientCount: room.clients.size,
        clients: getRoomClientSummaries(room),
        lastUpdated: room.lastUpdated,
      },
    });
  });

  // Master syncs current state to server
  app.post('/api/room/:roomId/sync', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { currentSong, isPlaying, queue, history, musicDelayMs } = req.body;

    if (currentSong !== undefined) room.currentSong = currentSong;
    if (isPlaying !== undefined) room.isPlaying = isPlaying;
    if (Array.isArray(queue)) room.queue = queue;
    if (Array.isArray(history)) room.history = history;
    if (typeof musicDelayMs === 'number') room.musicDelayMs = musicDelayMs;
    room.lastUpdated = Date.now();

    // Broadcast state update to all phones/clients
    broadcastToRoom(room, {
      type: 'STATE_UPDATE',
      roomId: room.roomId,
      payload: {
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        queue: room.queue,
        musicDelayMs: room.musicDelayMs,
        clientCount: room.clients.size,
      },
      timestamp: Date.now(),
    });

    res.json({ success: true, clientCount: room.clients.size, musicDelayMs: room.musicDelayMs });
  });

  // Client or Master adjusts TV music delay buffer
  app.post('/api/room/:roomId/music-delay', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { delayMs } = req.body;
    if (typeof delayMs === 'number') {
      const clamped = Math.max(0, Math.min(250, Math.round(delayMs)));
      room.musicDelayMs = clamped;
      room.lastUpdated = Date.now();
      broadcastToRoom(room, {
        type: 'MUSIC_SYNC_DELAY',
        roomId: room.roomId,
        payload: { delayMs: clamped },
        timestamp: Date.now(),
      });
      return res.json({ success: true, delayMs: clamped });
    }
    res.status(400).json({ success: false, error: 'delayMs must be a number' });
  });

  // Client & Master HTTP heartbeat ping (tracks live connected phones even when WebSockets are blocked)
  app.post('/api/room/:roomId/ping', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { clientId, singerName, role } = req.body;
    const id = clientId || `http-${req.ip || 'device'}`;

    const existing = room.clients.get(id);
    const isNew = !existing;
    const clientRecord: ConnectedClient = {
      id,
      name: singerName || existing?.name || (role === 'master' ? 'Layar Utama' : 'Prajurit (HP)'),
      role: role || 'client',
      lastSeen: Date.now(),
      connectedAt: existing?.connectedAt || Date.now(),
    };
    room.clients.set(id, clientRecord);

    // Prune stale HTTP clients that haven't pinged in 20 seconds
    const now = Date.now();
    for (const [cId, client] of room.clients.entries()) {
      if (!client.ws && client.lastSeen && now - client.lastSeen > 20000) {
        room.clients.delete(cId);
      }
    }

    if (isNew) {
      broadcastToRoom(room, {
        type: 'CLIENT_COUNT_UPDATE',
        roomId: room.roomId,
        payload: {
          clientCount: room.clients.size,
          clients: getRoomClientSummaries(room),
          joinedName: clientRecord.name,
        },
      });
    }

    res.json({
      success: true,
      clientCount: room.clients.size,
      room: {
        roomId: room.roomId,
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        queue: room.queue,
        musicDelayMs: room.musicDelayMs ?? 70,
        lastUpdated: room.lastUpdated,
      },
    });
  });

  // Client adds song to the master queue
  app.post('/api/room/:roomId/queue', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { song, singerName, priority } = req.body;

    if (!song || !song.id) {
      return res.status(400).json({ success: false, error: 'Data lagu tidak lengkap' });
    }

    const newItem = {
      queueId: `q-remote-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      song,
      singerName: singerName?.trim() || 'Prajurit (HP)',
      addedAt: Date.now(),
      priority: !!priority,
    };

    if (priority) {
      room.queue.unshift(newItem);
    } else {
      room.queue.push(newItem);
    }

    if (!room.currentSong) {
      room.currentSong = song;
      room.isPlaying = true;
    }
    room.lastUpdated = Date.now();

    // Broadcast ADD_QUEUE_ITEM to Master and all connected devices
    broadcastToRoom(room, {
      type: 'ADD_QUEUE_ITEM',
      roomId: room.roomId,
      payload: {
        item: newItem,
        senderName: newItem.singerName,
      },
      timestamp: Date.now(),
    });

    // Also broadcast STATE_UPDATE to ensure 100% sync
    broadcastToRoom(room, {
      type: 'STATE_UPDATE',
      roomId: room.roomId,
      payload: {
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        queue: room.queue,
        clientCount: room.clients.size,
      },
      timestamp: Date.now(),
    });

    res.json({ success: true, item: newItem, queueLength: room.queue.length, currentSong: room.currentSong });
  });

  // Client or master removes a song from queue
  app.post('/api/room/:roomId/remove', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { queueId } = req.body;

    if (!queueId) {
      return res.status(400).json({ success: false, error: 'queueId wajib diisi' });
    }

    room.queue = room.queue.filter((q) => q.queueId !== queueId);
    room.lastUpdated = Date.now();

    broadcastToRoom(room, {
      type: 'REMOVE_QUEUE_ITEM',
      roomId: room.roomId,
      payload: { queueId },
      timestamp: Date.now(),
    });

    res.json({ success: true, queue: room.queue });
  });

  // Client reorders queue (move up / down)
  app.post('/api/room/:roomId/reorder', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { fromIndex, toIndex, singerName } = req.body;

    if (
      typeof fromIndex === 'number' &&
      typeof toIndex === 'number' &&
      fromIndex >= 0 &&
      fromIndex < room.queue.length &&
      toIndex >= 0 &&
      toIndex < room.queue.length
    ) {
      const [moved] = room.queue.splice(fromIndex, 1);
      room.queue.splice(toIndex, 0, moved);
      room.lastUpdated = Date.now();

      broadcastToRoom(room, {
        type: 'SYNC_QUEUE',
        roomId: room.roomId,
        payload: { queue: room.queue, senderName: singerName || 'HP Client' },
        timestamp: Date.now(),
      });
      return res.json({ success: true, queue: room.queue });
    }
    return res.status(400).json({ success: false, error: 'Index antrean tidak valid' });
  });

  // Client changes song immediately (play now)
  app.post('/api/room/:roomId/play-now', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { song, singerName } = req.body;

    if (!song || !song.id) {
      return res.status(400).json({ success: false, error: 'Data lagu tidak valid' });
    }

    room.currentSong = song;
    room.isPlaying = true;
    room.lastUpdated = Date.now();

    broadcastToRoom(room, {
      type: 'PLAY_NOW',
      roomId: room.roomId,
      payload: { song, singerName: singerName || 'Prajurit (HP)' },
      timestamp: Date.now(),
    });

    res.json({ success: true, currentSong: room.currentSong });
  });

  // Client skips to next song
  app.post('/api/room/:roomId/skip', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { singerName, nextSong } = req.body;

    if (nextSong && nextSong.id) {
      room.currentSong = nextSong;
      room.isPlaying = true;
      room.queue = room.queue.filter((q) => q.song.id !== nextSong.id);
    } else if (room.queue.length > 0) {
      const nextItem = room.queue.shift();
      if (nextItem) {
        room.currentSong = nextItem.song;
        room.isPlaying = true;
      }
    }
    room.lastUpdated = Date.now();

    broadcastToRoom(room, {
      type: 'SKIP_NEXT',
      roomId: room.roomId,
      payload: { currentSong: room.currentSong, queue: room.queue, senderName: singerName || 'Prajurit (HP)' },
      timestamp: Date.now(),
    });

    broadcastToRoom(room, {
      type: 'STATE_UPDATE',
      roomId: room.roomId,
      payload: {
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        queue: room.queue,
        clientCount: room.clients.size,
      },
      timestamp: Date.now(),
    });

    res.json({ success: true, currentSong: room.currentSong, queue: room.queue });
  });

  // Client toggles play / pause on the TV & Tablet
  app.post('/api/room/:roomId/toggle-pause', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { senderName, isPlaying } = req.body;
    if (typeof isPlaying === 'boolean') {
      room.isPlaying = isPlaying;
    } else {
      room.isPlaying = !room.isPlaying;
    }
    room.lastUpdated = Date.now();

    broadcastToRoom(room, {
      type: 'TOGGLE_PAUSE',
      roomId: room.roomId,
      payload: { isPlaying: room.isPlaying, senderName: senderName || 'Tablet/HP' },
      timestamp: Date.now(),
    });

    res.json({ success: true, isPlaying: room.isPlaying });
  });

  // Client triggers sound effect reaction on the TV master screen
  app.post('/api/room/:roomId/reaction', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    const { sound, singerName } = req.body;

    broadcastToRoom(room, {
      type: 'PLAY_SOUND_FX',
      roomId: room.roomId,
      payload: {
        sound: sound || 'applause',
        senderName: singerName || 'Prajurit (HP)',
      },
      timestamp: Date.now(),
    });

    res.json({ success: true });
  });

  // Server-Sent Events (SSE) fallback stream
  app.get('/api/room/:roomId/events', (req, res) => {
    const roomId = req.params.roomId;
    const room = getOrCreateRoom(roomId);
    const clientId = `sse-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const clientName = (req.query.name as string) || 'HP Client';
    const role = (req.query.role as 'master' | 'client') || 'client';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');

    const connectedClient: ConnectedClient = {
      id: clientId,
      name: clientName,
      role,
      sseRes: res,
      connectedAt: Date.now(),
    };
    room.clients.set(clientId, connectedClient);

    // Send initial snapshot
    res.write(
      `data: ${JSON.stringify({
        type: 'INIT_STATE',
        roomId: room.roomId,
        payload: {
          currentSong: room.currentSong,
          isPlaying: room.isPlaying,
          queue: room.queue,
          clientCount: room.clients.size,
          clients: getRoomClientSummaries(room),
        },
        timestamp: Date.now(),
      })}\n\n`
    );

    // Notify room of new device
    broadcastToRoom(room, {
      type: 'CLIENT_COUNT_UPDATE',
      roomId: room.roomId,
      payload: {
        clientCount: room.clients.size,
        clients: getRoomClientSummaries(room),
        joinedName: clientName,
      },
      timestamp: Date.now(),
    });

    req.on('close', () => {
      room.clients.delete(clientId);
      broadcastToRoom(room, {
        type: 'CLIENT_COUNT_UPDATE',
        roomId: room.roomId,
        payload: {
          clientCount: room.clients.size,
          clients: getRoomClientSummaries(room),
        },
        timestamp: Date.now(),
      });
    });
  });

  // Create unified HTTP server
  const server = http.createServer(app);

  // WebSocket Server for Karaoke sync attached cleanly using noServer mode
  const wss = new WebSocketServer({ noServer: true });
  // Dummy WebSocket server for Vite HMR to cleanly open without closing prematurely
  const viteWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        // Accept Vite HMR WebSocket connection cleanly so browser does not throw "WebSocket closed without opened"
        viteWss.handleUpgrade(request, socket, head, (ws) => {
          try {
            ws.send(JSON.stringify({ type: 'connected' }));
          } catch {}
          ws.on('message', () => {});
        });
      }
    } catch {
      // Allow other upgrade listeners to proceed
    }
  });

  // Explicit PWA routes to guarantee installability across Android Chrome, iOS, and Smart TV
  const publicDir = path.resolve(__dirname, 'public');
  const distDir = path.resolve(__dirname, 'dist');

  const servePwaAsset = (fileName: string, contentType: string, extraHeaders: Record<string, string> = {}) => {
    return (_req: express.Request, res: express.Response) => {
      const distFile = path.resolve(distDir, fileName);
      const publicFile = path.resolve(publicDir, fileName);
      const targetFile = fs.existsSync(distFile) ? distFile : (fs.existsSync(publicFile) ? publicFile : null);

      if (targetFile) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        Object.entries(extraHeaders).forEach(([k, v]) => res.setHeader(k, v));
        return res.sendFile(targetFile);
      }
      res.status(404).send('Asset not found');
    };
  };

  app.get('/manifest.json', servePwaAsset('manifest.json', 'application/manifest+json'));
  app.get('/manifest.webmanifest', servePwaAsset('manifest.webmanifest', 'application/manifest+json'));
  app.get('/sw.js', servePwaAsset('sw.js', 'application/javascript; charset=utf-8', { 'Service-Worker-Allowed': '/' }));
  app.get('/registerSW.js', servePwaAsset('registerSW.js', 'application/javascript; charset=utf-8'));
  app.get('/pwa-192x192.png', servePwaAsset('pwa-192x192.png', 'image/png'));
  app.get('/pwa-512x512.png', servePwaAsset('pwa-512x512.png', 'image/png'));
  app.get('/pwa-maskable-512x512.png', servePwaAsset('pwa-maskable-512x512.png', 'image/png'));
  app.get('/apple-touch-icon.png', servePwaAsset('apple-touch-icon.png', 'image/png'));
  app.get('/favicon.ico', servePwaAsset('favicon.ico', 'image/x-icon'));
  app.get('/icon.svg', servePwaAsset('icon.svg', 'image/svg+xml'));

  // Vite middleware in dev or static files in prod
  if (!isProduction) {
    if (typeof (globalThis as any).__dirname === 'string' && (globalThis as any).__dirname === '.') {
      delete (globalThis as any).__dirname;
    }
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.resolve(distPath, 'index.html');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          res.status(500).send('Application build in progress. Please refresh shortly.');
        }
      });
    });
  }

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const roomId = (url.searchParams.get('room') || 'DEFAULT-ROOM').trim().toUpperCase();
    const role = (url.searchParams.get('role') as 'master' | 'client') || 'client';
    const singerName = url.searchParams.get('singer') || (role === 'master' ? 'Layar Utama' : 'Prajurit (HP)');

    const room = getOrCreateRoom(roomId);
    const clientId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const clientRecord: ConnectedClient = {
      id: clientId,
      name: singerName,
      role,
      ws,
      connectedAt: Date.now(),
    };
    room.clients.set(clientId, clientRecord);

    // Send initial snapshot to newly connected device
    ws.send(
      JSON.stringify({
        type: 'INIT_STATE',
        roomId: room.roomId,
        assignedClientId: clientId,
        payload: {
          currentSong: room.currentSong,
          isPlaying: room.isPlaying,
          queue: room.queue,
          musicDelayMs: room.musicDelayMs ?? 70,
          clientCount: room.clients.size,
          clients: getRoomClientSummaries(room),
        },
        timestamp: Date.now(),
      })
    );

    // Broadcast client join update
    broadcastToRoom(room, {
      type: 'CLIENT_COUNT_UPDATE',
      roomId: room.roomId,
      payload: {
        clientCount: room.clients.size,
        clients: getRoomClientSummaries(room),
        joinedName: singerName,
      },
      timestamp: Date.now(),
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case 'PING': {
            try {
              ws.send(JSON.stringify({ type: 'PONG', roomId: room.roomId, timestamp: Date.now() }));
            } catch {}
            break;
          }

          case 'SYNC_STATE': {
            if (msg.payload) {
              if (msg.payload.currentSong !== undefined) room.currentSong = msg.payload.currentSong;
              if (msg.payload.isPlaying !== undefined) room.isPlaying = msg.payload.isPlaying;
              if (Array.isArray(msg.payload.queue)) room.queue = msg.payload.queue;
              if (typeof msg.payload.musicDelayMs === 'number') room.musicDelayMs = msg.payload.musicDelayMs;
              room.lastUpdated = Date.now();

              broadcastToRoom(
                room,
                {
                  type: 'STATE_UPDATE',
                  roomId: room.roomId,
                  payload: {
                    currentSong: room.currentSong,
                    isPlaying: room.isPlaying,
                    queue: room.queue,
                    musicDelayMs: room.musicDelayMs,
                    clientCount: room.clients.size,
                  },
                  timestamp: Date.now(),
                },
                ws
              );
            }
            break;
          }

          case 'ADD_QUEUE_ITEM': {
            const { song, singerName: addedBy, priority } = msg.payload || {};
            if (song && song.id) {
              const item = {
                queueId: `q-ws-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                song,
                singerName: addedBy || singerName || 'Prajurit (HP)',
                addedAt: Date.now(),
                priority: !!priority,
              };

              if (priority) {
                room.queue.unshift(item);
              } else {
                room.queue.push(item);
              }
              room.lastUpdated = Date.now();

              // Broadcast to everyone (including master)
              broadcastToRoom(room, {
                type: 'ADD_QUEUE_ITEM',
                roomId: room.roomId,
                payload: {
                  item,
                  senderName: item.singerName,
                },
                timestamp: Date.now(),
              });
            }
            break;
          }

          case 'REMOVE_QUEUE_ITEM': {
            const queueId = msg.payload?.queueId;
            if (queueId) {
              room.queue = room.queue.filter((q) => q.queueId !== queueId);
              room.lastUpdated = Date.now();
              broadcastToRoom(room, {
                type: 'REMOVE_QUEUE_ITEM',
                roomId: room.roomId,
                payload: { queueId },
                timestamp: Date.now(),
              });
            }
            break;
          }

          case 'MOVE_QUEUE_ITEM': {
            const { fromIndex, toIndex } = msg.payload || {};
            if (
              typeof fromIndex === 'number' &&
              typeof toIndex === 'number' &&
              fromIndex >= 0 &&
              fromIndex < room.queue.length &&
              toIndex >= 0 &&
              toIndex < room.queue.length
            ) {
              const [moved] = room.queue.splice(fromIndex, 1);
              room.queue.splice(toIndex, 0, moved);
              room.lastUpdated = Date.now();

              broadcastToRoom(room, {
                type: 'SYNC_QUEUE',
                roomId: room.roomId,
                payload: { queue: room.queue, senderName: singerName },
                timestamp: Date.now(),
              });
            }
            break;
          }

          case 'PLAY_NOW': {
            const song = msg.payload?.song;
            const singer = msg.payload?.singerName || singerName;
            if (song && song.id) {
              room.currentSong = song;
              room.isPlaying = true;
              room.lastUpdated = Date.now();

              broadcastToRoom(room, {
                type: 'PLAY_NOW',
                roomId: room.roomId,
                payload: { song, singerName: singer },
                timestamp: Date.now(),
              });
            }
            break;
          }

          case 'PLAY_SOUND_FX': {
            broadcastToRoom(room, {
              type: 'PLAY_SOUND_FX',
              roomId: room.roomId,
              payload: {
                sound: msg.payload?.sound || 'applause',
                senderName: singerName,
              },
              timestamp: Date.now(),
            });
            break;
          }

          case 'SKIP_NEXT': {
            broadcastToRoom(room, {
              type: 'SKIP_NEXT',
              roomId: room.roomId,
              payload: { senderName: singerName },
              timestamp: Date.now(),
            });
            break;
          }

          case 'TOGGLE_PAUSE': {
            if (typeof msg.payload?.isPlaying === 'boolean') {
              room.isPlaying = msg.payload.isPlaying;
            } else {
              room.isPlaying = !room.isPlaying;
            }
            room.lastUpdated = Date.now();
            broadcastToRoom(room, {
              type: 'TOGGLE_PAUSE',
              roomId: room.roomId,
              payload: { isPlaying: room.isPlaying, senderName: singerName },
              timestamp: Date.now(),
            });
            break;
          }

          // WebRTC P2P Audio Streaming Signaling
          case 'RTC_OFFER': {
            const { targetClientId, offer, senderName: customSender } = msg.payload || {};
            const payload = {
              senderId: clientId,
              senderName: customSender || singerName,
              offer,
            };
            room.clients.forEach((c) => {
              if (c.id !== clientId) {
                if ((targetClientId && c.id === targetClientId) || (!targetClientId && c.role === 'master')) {
                  if (c.ws && c.ws.readyState === WebSocket.OPEN) {
                    c.ws.send(JSON.stringify({
                      type: 'RTC_OFFER',
                      roomId: room.roomId,
                      payload,
                      timestamp: Date.now(),
                    }));
                  }
                }
              }
            });
            break;
          }

          case 'RTC_ANSWER': {
            const { targetClientId, answer } = msg.payload || {};
            if (targetClientId) {
              const targetClient = room.clients.get(targetClientId);
              if (targetClient && targetClient.ws && targetClient.ws.readyState === WebSocket.OPEN) {
                targetClient.ws.send(JSON.stringify({
                  type: 'RTC_ANSWER',
                  roomId: room.roomId,
                  payload: {
                    senderId: clientId,
                    answer,
                  },
                  timestamp: Date.now(),
                }));
              }
            }
            break;
          }

          case 'RTC_ICE_CANDIDATE': {
            const { targetClientId, candidate } = msg.payload || {};
            if (targetClientId) {
              const targetClient = room.clients.get(targetClientId);
              if (targetClient && targetClient.ws && targetClient.ws.readyState === WebSocket.OPEN) {
                targetClient.ws.send(JSON.stringify({
                  type: 'RTC_ICE_CANDIDATE',
                  roomId: room.roomId,
                  payload: {
                    senderId: clientId,
                    candidate,
                  },
                  timestamp: Date.now(),
                }));
              }
            } else {
              room.clients.forEach((c) => {
                if (c.id !== clientId && c.role === 'master') {
                  if (c.ws && c.ws.readyState === WebSocket.OPEN) {
                    c.ws.send(JSON.stringify({
                      type: 'RTC_ICE_CANDIDATE',
                      roomId: room.roomId,
                      payload: {
                        senderId: clientId,
                        candidate,
                      },
                      timestamp: Date.now(),
                    }));
                  }
                }
              });
            }
            break;
          }

          case 'RTC_MIC_STATUS': {
            const { isMicOn, senderName: customSender } = msg.payload || {};
            broadcastToRoom(room, {
              type: 'RTC_MIC_STATUS',
              roomId: room.roomId,
              payload: {
                senderId: clientId,
                senderName: customSender || singerName,
                isMicOn: !!isMicOn,
              },
              timestamp: Date.now(),
            });
            break;
          }

          case 'RTC_MIC_PARAMS': {
            const { targetClientId, volume, echo, isMuted, senderName: customSender } = msg.payload || {};
            if (targetClientId) {
              const targetClient = room.clients.get(targetClientId);
              if (targetClient && targetClient.ws && targetClient.ws.readyState === WebSocket.OPEN) {
                targetClient.ws.send(JSON.stringify({
                  type: 'RTC_MIC_PARAMS',
                  roomId: room.roomId,
                  payload: {
                    senderId: clientId,
                    targetClientId,
                    senderName: customSender || singerName,
                    volume,
                    echo,
                    isMuted,
                  },
                  timestamp: Date.now(),
                }));
              }
            } else {
              // Route to master so Master can adjust the individual stream's gain & echo without overriding other phones
              room.clients.forEach((c) => {
                if (c.role === 'master' && c.ws && c.ws.readyState === WebSocket.OPEN) {
                  c.ws.send(JSON.stringify({
                    type: 'RTC_MIC_PARAMS',
                    roomId: room.roomId,
                    payload: {
                      senderId: clientId,
                      senderName: customSender || singerName,
                      volume,
                      echo,
                      isMuted,
                    },
                    timestamp: Date.now(),
                  }));
                }
              });
            }
            break;
          }

          // Live audio relay chunk stream (guarantees audio entry into master even if P2P NAT fails)
          case 'CLIENT_MIC_AUDIO_DATA': {
            const audioPayload = {
              senderId: clientId,
              senderName: msg.payload?.senderName || singerName,
              pcm: msg.payload?.pcm,
              sampleRate: msg.payload?.sampleRate || 48000,
              level: msg.payload?.level || 0,
              timestamp: Date.now(),
            };
            room.clients.forEach((c) => {
              if (c.id !== clientId && c.role === 'master' && c.ws && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(JSON.stringify({
                  type: 'CLIENT_MIC_AUDIO_DATA',
                  roomId: room.roomId,
                  payload: audioPayload,
                  timestamp: Date.now(),
                }));
              }
            });
            break;
          }

          // Live VU meter audio level from client phone mic
          case 'RTC_MIC_LEVEL': {
            const levelPayload = {
              senderId: clientId,
              senderName: msg.payload?.senderName || singerName,
              level: msg.payload?.level || 0,
            };
            room.clients.forEach((c) => {
              if (c.id !== clientId && c.role === 'master' && c.ws && c.ws.readyState === WebSocket.OPEN) {
                c.ws.send(JSON.stringify({
                  type: 'RTC_MIC_LEVEL',
                  roomId: room.roomId,
                  payload: levelPayload,
                  timestamp: Date.now(),
                }));
              }
            });
            break;
          }

          // Vocal sync buffer delay adjustment (syncs TV music delay)
          case 'MUSIC_SYNC_DELAY': {
            const delayMs = msg.payload?.delayMs;
            if (typeof delayMs === 'number') {
              const clamped = Math.max(0, Math.min(250, Math.round(delayMs)));
              room.musicDelayMs = clamped;
              room.lastUpdated = Date.now();
              broadcastToRoom(room, {
                type: 'MUSIC_SYNC_DELAY',
                roomId: room.roomId,
                payload: { delayMs: clamped },
                timestamp: Date.now(),
              });
            }
            break;
          }
        }
      } catch (err) {
        console.warn('WS message error:', err);
      }
    });

    ws.on('close', () => {
      room.clients.delete(clientId);
      broadcastToRoom(room, {
        type: 'RTC_MIC_STATUS',
        roomId: room.roomId,
        payload: {
          senderId: clientId,
          senderName: singerName,
          isMicOn: false,
        },
        timestamp: Date.now(),
      });
      broadcastToRoom(room, {
        type: 'CLIENT_COUNT_UPDATE',
        roomId: room.roomId,
        payload: {
          clientCount: room.clients.size,
          clients: getRoomClientSummaries(room),
        },
        timestamp: Date.now(),
      });
    });

    ws.on('error', (err) => {
      console.warn('WS connection error:', err);
    });
  });

  server.on('error', (err: any) => {
    console.error('Server error on port ' + PORT + ':', err);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server karaoke aktif di port ${PORT} (WebSocket + REST + Scraping).`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();

