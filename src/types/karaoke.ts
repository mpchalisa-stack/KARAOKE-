export interface Song {
  id: string; // YouTube Video ID
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration?: string;
  publishedAt?: string;
  isCurated?: boolean;
}

export interface QueueItem {
  queueId: string;
  song: Song;
  singerName: string;
  addedAt: number;
  priority?: boolean;
}

export type SuffixFilter = 'karaoke' | 'no vocal' | 'instrumental' | 'none';

export interface CategoryPreset {
  id: string;
  label: string;
  query: string;
  description: string;
  iconName: string;
  badgeColor: string;
}

export type WebSocketMessageType =
  | 'CLIENT_CONNECTED'
  | 'JOIN_ROOM'
  | 'INIT_STATE'
  | 'STATE_UPDATE'
  | 'CLIENT_COUNT_UPDATE'
  | 'SYNC_STATE'
  | 'SYNC_QUEUE'
  | 'ADD_QUEUE_ITEM'
  | 'REMOVE_QUEUE_ITEM'
  | 'MOVE_QUEUE_ITEM'
  | 'PLAY_NOW'
  | 'SKIP_NEXT'
  | 'TOGGLE_PAUSE'
  | 'PLAY_SOUND_FX'
  | 'SET_SINGER'
  | 'MUSIC_SYNC_DELAY';

export type SoundFxType = 'applause' | 'cheer' | 'airhorn' | 'ding' | 'rimshot' | 'boo' | 'laugh';

export interface ScreenReaction {
  id: string;
  type: SoundFxType;
  label: string;
  emoji: string;
  senderName: string;
  timestamp: number;
}

export interface RemoteClientInfo {
  id: string;
  name: string;
  role: 'master' | 'client';
}

export interface RemoteNotification {
  id: string;
  message: string;
  senderName?: string;
  type?: 'info' | 'success' | 'alert';
  timestamp: number;
}

export interface SongScoreData {
  song: Song;
  singerName: string;
  totalScore: number;
  grade: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  rankTitle: string;
  commentary: string;
  pitchAccuracy: number;
  vocalPower: number;
  stagePresence: number;
  combatSpirit: number;
  nextSong?: Song;
  nextSingerName?: string;
  evaluatedAt: number;
}


export interface WebSocketMessage {
  type: WebSocketMessageType;
  roomId?: string;
  payload?: any;
  senderName?: string;
  timestamp: number;
}
