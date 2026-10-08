import { Song, SuffixFilter, CategoryPreset } from '../types/karaoke';

export const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    id: 'hits-indonesia',
    label: 'Favorit Hits Indonesia',
    query: 'Lagu Karaoke Hit Indonesia Populer',
    description: 'Naff, Cakra Khan, Kerispatih, Java Jive, Ada Band, Dewa 19, Sheila on 7',
    iconName: 'Flame',
    badgeColor: 'from-rose-500 via-amber-500 to-red-600',
  },
  {
    id: 'naff-cakra',
    label: 'Naff & Cakra Khan',
    query: 'Naff Cakra Khan Karaoke Populer',
    description: 'Kenanglah Aku, Akhirnya Ku Menemukanmu, Kekasih Bayangan, Harus Terpisah',
    iconName: 'Mic',
    badgeColor: 'from-amber-500 to-orange-600',
  },
  {
    id: 'kerispatih-adaband',
    label: 'Kerispatih & Ada Band',
    query: 'Kerispatih Ada Band Karaoke Hits',
    description: 'Demi Cinta, Bila Rasaku Ini Rasamu, Manusia Bodoh, Karena Wanita',
    iconName: 'Music',
    badgeColor: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'java-jive-nostalgia',
    label: 'Java Jive & 90s Indo',
    query: 'Java Jive 90s Pop Indonesia Karaoke',
    description: 'Gerangan Cinta, Menikah, Kangen, Dan, Kenangan Terindah',
    iconName: 'Disc',
    badgeColor: 'from-sky-500 to-indigo-600',
  },
  {
    id: 'slow-rock',
    label: 'Slow Rock Ballads',
    query: 'Slow Rock Ballads',
    description: 'Scorpions, Bon Jovi, Guns N Roses, White Lion, Deep Purple',
    iconName: 'Radio',
    badgeColor: 'from-purple-500 to-pink-600',
  },
  {
    id: 'dangdut-koplo',
    label: 'Dangdut & Koplo',
    query: 'Dangdut Koplo Populer',
    description: 'Rhoma Irama, Denny Caknan, Via Vallen, Didi Kempot',
    iconName: 'Sparkles',
    badgeColor: 'from-yellow-400 to-amber-500',
  },
];

// Curated high quality karaoke video IDs for instant play & fallback
export const CURATED_LIBRARY: Record<string, Song[]> = {
  'hits-indonesia': [
    {
      id: 'BnlzOzdP8Is',
      title: 'Naff - Kenanglah Aku (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/BnlzOzdP8Is/hqdefault.jpg',
      duration: '4:10',
      isCurated: true,
    },
    {
      id: 'AHZlSVQc7FE',
      title: 'Naff - Akhirnya Ku Menemukanmu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/AHZlSVQc7FE/hqdefault.jpg',
      duration: '4:49',
      isCurated: true,
    },
    {
      id: 'yyBA_2Gv3RA',
      title: 'Cakra Khan - Kekasih Bayangan (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/yyBA_2Gv3RA/hqdefault.jpg',
      duration: '4:53',
      isCurated: true,
    },
    {
      id: 'oo_Ldc9hfj0',
      title: 'Cakra Khan - Harus Terpisah (Karaoke Version)',
      channelTitle: 'ARF Music',
      thumbnailUrl: 'https://img.youtube.com/vi/oo_Ldc9hfj0/hqdefault.jpg',
      duration: '3:59',
      isCurated: true,
    },
    {
      id: '7smwlWzip0k',
      title: 'Kerispatih - Demi Cinta (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/7smwlWzip0k/hqdefault.jpg',
      duration: '5:02',
      isCurated: true,
    },
    {
      id: 'AwP1nVaFaNA',
      title: 'Kerispatih - Bila Rasaku Ini Rasamu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/AwP1nVaFaNA/hqdefault.jpg',
      duration: '4:51',
      isCurated: true,
    },
    {
      id: 'y4tuQ2kXwT8',
      title: 'Kerispatih - Lagu Rindu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/y4tuQ2kXwT8/hqdefault.jpg',
      duration: '4:48',
      isCurated: true,
    },
    {
      id: 'bP_idWQ60bc',
      title: 'Java Jive - Gerangan Cinta (Official Karaoke Video No Vocal)',
      channelTitle: 'Musica Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/bP_idWQ60bc/hqdefault.jpg',
      duration: '5:31',
      isCurated: true,
    },
    {
      id: 'WHyRvFKJ4rg',
      title: 'Java Jive - Menikah (Official Karaoke Video No Vocal)',
      channelTitle: 'Musica Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/WHyRvFKJ4rg/hqdefault.jpg',
      duration: '4:04',
      isCurated: true,
    },
    {
      id: 'tljYFLQupq8',
      title: 'Ada Band - Manusia Bodoh (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/tljYFLQupq8/hqdefault.jpg',
      duration: '4:33',
      isCurated: true,
    },
    {
      id: 'vQtrfTSy0GY',
      title: 'Ada Band - Karena Wanita (Ingin Dimengerti) (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/vQtrfTSy0GY/hqdefault.jpg',
      duration: '4:50',
      isCurated: true,
    },
    {
      id: '3MWDBse8qPU',
      title: 'Ada Band - Haruskah Ku Mati (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/3MWDBse8qPU/hqdefault.jpg',
      duration: '4:56',
      isCurated: true,
    },
    {
      id: '8L7fRR2NwU0',
      title: 'Ada Band - Masih (Sahabatku Kekasihku) (Karaoke Version)',
      channelTitle: 'Tangga Music Studio',
      thumbnailUrl: 'https://img.youtube.com/vi/8L7fRR2NwU0/hqdefault.jpg',
      duration: '5:14',
      isCurated: true,
    },
    {
      id: 'Y2k4Ex5aWs4',
      title: 'Dewa 19 - Kangen (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/Y2k4Ex5aWs4/hqdefault.jpg',
      duration: '5:23',
      isCurated: true,
    },
    {
      id: 'F4kPLr5ngLo',
      title: 'Sheila On 7 - Dan (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/F4kPLr5ngLo/hqdefault.jpg',
      duration: '4:56',
      isCurated: true,
    },
    {
      id: 'ACgWSbWgU-U',
      title: 'Samsons - Kenangan Terindah (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/ACgWSbWgU-U/hqdefault.jpg',
      duration: '4:16',
      isCurated: true,
    },
    {
      id: 'Boc2E7RSGnc',
      title: 'Ungu - Demi Waktu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/Boc2E7RSGnc/hqdefault.jpg',
      duration: '5:10',
      isCurated: true,
    },
    {
      id: 'IUfZaqPqVPg',
      title: 'Peterpan - Menghapus Jejakmu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/IUfZaqPqVPg/hqdefault.jpg',
      duration: '3:23',
      isCurated: true,
    },
  ],
  'naff-cakra': [
    {
      id: 'BnlzOzdP8Is',
      title: 'Naff - Kenanglah Aku (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/BnlzOzdP8Is/hqdefault.jpg',
      duration: '4:10',
      isCurated: true,
    },
    {
      id: 'AHZlSVQc7FE',
      title: 'Naff - Akhirnya Ku Menemukanmu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/AHZlSVQc7FE/hqdefault.jpg',
      duration: '4:49',
      isCurated: true,
    },
    {
      id: 'otoJG0QdxIA',
      title: 'Naff - Terendap Laraku (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/otoJG0QdxIA/hqdefault.jpg',
      duration: '5:24',
      isCurated: true,
    },
    {
      id: 'yyBA_2Gv3RA',
      title: 'Cakra Khan - Kekasih Bayangan (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/yyBA_2Gv3RA/hqdefault.jpg',
      duration: '4:53',
      isCurated: true,
    },
    {
      id: 'oo_Ldc9hfj0',
      title: 'Cakra Khan - Harus Terpisah (Karaoke Version)',
      channelTitle: 'ARF Music',
      thumbnailUrl: 'https://img.youtube.com/vi/oo_Ldc9hfj0/hqdefault.jpg',
      duration: '3:59',
      isCurated: true,
    },
  ],
  'kerispatih-adaband': [
    {
      id: '7smwlWzip0k',
      title: 'Kerispatih - Demi Cinta (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/7smwlWzip0k/hqdefault.jpg',
      duration: '5:02',
      isCurated: true,
    },
    {
      id: 'AwP1nVaFaNA',
      title: 'Kerispatih - Bila Rasaku Ini Rasamu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/AwP1nVaFaNA/hqdefault.jpg',
      duration: '4:51',
      isCurated: true,
    },
    {
      id: 'y4tuQ2kXwT8',
      title: 'Kerispatih - Lagu Rindu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/y4tuQ2kXwT8/hqdefault.jpg',
      duration: '4:48',
      isCurated: true,
    },
    {
      id: 'R8KkGn2ULD8',
      title: 'Kerispatih - Aku Harus Jujur (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/R8KkGn2ULD8/hqdefault.jpg',
      duration: '4:42',
      isCurated: true,
    },
    {
      id: 'qipJJo7ea_c',
      title: 'Kerispatih - Kejujuran Hati (Karaoke Tanpa Vokal)',
      channelTitle: 'Danker Studio',
      thumbnailUrl: 'https://img.youtube.com/vi/qipJJo7ea_c/hqdefault.jpg',
      duration: '6:20',
      isCurated: true,
    },
    {
      id: 'tljYFLQupq8',
      title: 'Ada Band - Manusia Bodoh (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/tljYFLQupq8/hqdefault.jpg',
      duration: '4:33',
      isCurated: true,
    },
    {
      id: 'vQtrfTSy0GY',
      title: 'Ada Band - Karena Wanita (Ingin Dimengerti) (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/vQtrfTSy0GY/hqdefault.jpg',
      duration: '4:50',
      isCurated: true,
    },
    {
      id: '3MWDBse8qPU',
      title: 'Ada Band - Haruskah Ku Mati (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/3MWDBse8qPU/hqdefault.jpg',
      duration: '4:56',
      isCurated: true,
    },
    {
      id: '8L7fRR2NwU0',
      title: 'Ada Band - Masih (Sahabatku Kekasihku) (Karaoke Version)',
      channelTitle: 'Tangga Music Studio',
      thumbnailUrl: 'https://img.youtube.com/vi/8L7fRR2NwU0/hqdefault.jpg',
      duration: '5:14',
      isCurated: true,
    },
  ],
  'java-jive-nostalgia': [
    {
      id: 'bP_idWQ60bc',
      title: 'Java Jive - Gerangan Cinta (Official Karaoke Video No Vocal)',
      channelTitle: 'Musica Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/bP_idWQ60bc/hqdefault.jpg',
      duration: '5:31',
      isCurated: true,
    },
    {
      id: 'WHyRvFKJ4rg',
      title: 'Java Jive - Menikah (Official Karaoke Video No Vocal)',
      channelTitle: 'Musica Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/WHyRvFKJ4rg/hqdefault.jpg',
      duration: '4:04',
      isCurated: true,
    },
    {
      id: 'Y2k4Ex5aWs4',
      title: 'Dewa 19 - Kangen (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/Y2k4Ex5aWs4/hqdefault.jpg',
      duration: '5:23',
      isCurated: true,
    },
    {
      id: 'F4kPLr5ngLo',
      title: 'Sheila On 7 - Dan (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/F4kPLr5ngLo/hqdefault.jpg',
      duration: '4:56',
      isCurated: true,
    },
    {
      id: 'ACgWSbWgU-U',
      title: 'Samsons - Kenangan Terindah (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/ACgWSbWgU-U/hqdefault.jpg',
      duration: '4:16',
      isCurated: true,
    },
    {
      id: 'Boc2E7RSGnc',
      title: 'Ungu - Demi Waktu (Karaoke Version)',
      channelTitle: 'Capleo Music',
      thumbnailUrl: 'https://img.youtube.com/vi/Boc2E7RSGnc/hqdefault.jpg',
      duration: '5:10',
      isCurated: true,
    },
    {
      id: 'TTy8adFm0aQ',
      title: 'Padi - Menanti Sebuah Jawaban (Karaoke HQ Audio)',
      channelTitle: 'Replay Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/TTy8adFm0aQ/hqdefault.jpg',
      duration: '4:35',
      isCurated: true,
    },
  ],
  'slow-rock': [
    {
      id: 'nCbzF356088',
      title: 'Scorpions - Wind Of Change (Karaoke Version)',
      channelTitle: 'Sing King Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/nCbzF356088/hqdefault.jpg',
      duration: '5:10',
      isCurated: true,
    },
    {
      id: 's88r_q7oufE',
      title: 'Bon Jovi - Bed Of Roses (Karaoke With Lyrics)',
      channelTitle: 'Karaoke Star HD',
      thumbnailUrl: 'https://img.youtube.com/vi/s88r_q7oufE/hqdefault.jpg',
      duration: '6:35',
      isCurated: true,
    },
    {
      id: '8SbUCzKW9vQ',
      title: 'Guns N Roses - November Rain (Official Karaoke Instrumental)',
      channelTitle: 'Rock Karaoke Classics',
      thumbnailUrl: 'https://img.youtube.com/vi/8SbUCzKW9vQ/hqdefault.jpg',
      duration: '8:57',
      isCurated: true,
    },
    {
      id: 'xfr64nMz7n0',
      title: 'White Lion - When The Children Cry (Karaoke No Vocal)',
      channelTitle: '80s Ballad Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/xfr64nMz7n0/hqdefault.jpg',
      duration: '4:20',
      isCurated: true,
    },
  ],
  'dangdut-koplo': [
    {
      id: 'vdB-8eLEW8g',
      title: 'Denny Caknan - Kartonyono Medot Janji (Karaoke Kendang)',
      channelTitle: 'Campursari Karaoke HD',
      thumbnailUrl: 'https://img.youtube.com/vi/vdB-8eLEW8g/hqdefault.jpg',
      duration: '4:50',
      isCurated: true,
    },
    {
      id: 'r3Pr1P3Q7ic',
      title: 'Didi Kempot - Pamer Bojo (Karaoke Versi Cendol Dawet)',
      channelTitle: 'Sobat Ambyar Official Karaoke',
      thumbnailUrl: 'https://img.youtube.com/vi/r3Pr1P3Q7ic/hqdefault.jpg',
      duration: '4:40',
      isCurated: true,
    },
  ],
};

// Clean HTML entities returned by YouTube API (e.g., &#39; -> ')
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

// Extract Video ID if user pastes YouTube URL
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Build the exact search query by automatically appending 'karaoke' or 'no vocal'
 */
export function buildKaraokeQuery(userInput: string, suffix: SuffixFilter): string {
  const cleanInput = userInput.trim();
  if (!cleanInput) return '';

  const lower = cleanInput.toLowerCase();
  if (suffix === 'karaoke') {
    if (!lower.includes('karaoke')) {
      return `${cleanInput} karaoke`;
    }
    return cleanInput;
  }
  if (suffix === 'no vocal') {
    if (!lower.includes('no vocal') && !lower.includes('tanpa vokal')) {
      return `${cleanInput} no vocal`;
    }
    return cleanInput;
  }
  if (suffix === 'instrumental') {
    if (!lower.includes('instrumental')) {
      return `${cleanInput} instrumental`;
    }
    return cleanInput;
  }
  return cleanInput;
}

/**
 * Fetch video details via public YouTube oEmbed (Zero API Key required)
 */
export async function fetchOEmbedInfo(videoId: string): Promise<{ title?: string; author_name?: string } | null> {
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
    );
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title,
        author_name: data.author_name,
      };
    }
  } catch (e) {
    // fallback
  }
  return null;
}

/**
 * Public Invidious mirror search fallback (No API key needed)
 */
async function searchViaInvidious(query: string): Promise<Song[]> {
  const mirrors = [
    'https://inv.nadeko.net/api/v1/search',
    'https://invidious.nerdvpn.de/api/v1/search',
  ];

  for (const mirror of mirrors) {
    try {
      const res = await fetch(`${mirror}?q=${encodeURIComponent(query)}&type=video`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          return items.slice(0, 16).map((item: any) => ({
            id: item.videoId,
            title: decodeHtmlEntities(item.title || ''),
            channelTitle: item.author || 'YouTube Karaoke',
            thumbnailUrl:
              item.videoThumbnails?.[0]?.url ||
              `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
            duration: typeof item.lengthSeconds === 'number'
              ? `${Math.floor(item.lengthSeconds / 60)}:${String(item.lengthSeconds % 60).padStart(2, '0')}`
              : '',
            isCurated: false,
          }));
        }
      }
    } catch (e) {
      // try next mirror
    }
  }
  return [];
}

/**
 * Primary YouTube search function with server-side proxy
 */
export async function searchYouTube(
  query: string,
  suffix: SuffixFilter = 'karaoke'
): Promise<Song[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return CURATED_LIBRARY['hits-indonesia'] || [];
  }

  // 1. Direct link detection
  const extractedId = extractYoutubeVideoId(trimmed);
  if (extractedId) {
    const info = await fetchOEmbedInfo(extractedId);
    return [
      {
        id: extractedId,
        title: info?.title || `YouTube Video (${extractedId})`,
        channelTitle: info?.author_name || 'YouTube',
        thumbnailUrl: `https://img.youtube.com/vi/${extractedId}/hqdefault.jpg`,
        duration: 'YouTube',
        isCurated: false,
      },
    ];
  }

  const finalQuery = buildKaraokeQuery(trimmed, suffix);

  // 2. Server proxy search route
  try {
    const resp = await fetch(`/api/search?q=${encodeURIComponent(finalQuery)}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && Array.isArray(data.songs) && data.songs.length > 0) {
        return data.songs.map((v: any) => ({
          id: v.id,
          title: decodeHtmlEntities(v.title || ''),
          channelTitle: v.channelTitle || 'YouTube',
          thumbnailUrl: v.thumbnailUrl || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
          duration: v.duration || '',
          publishedAt: v.publishedAt,
          isCurated: false,
        }));
      }
    }
  } catch (err) {
    console.warn('Backend proxy search encountered an issue, trying Invidious fallback:', err);
  }

  // 3. Invidious mirror fallback
  try {
    const invidiousResults = await searchViaInvidious(finalQuery);
    if (invidiousResults.length > 0) {
      return invidiousResults;
    }
  } catch (e) {
    // continue to fallback
  }

  // 4. Return curated library matching keywords or hits-indonesia
  const lowerQ = trimmed.toLowerCase();
  for (const [catKey, songs] of Object.entries(CURATED_LIBRARY)) {
    if (songs.some((s) => s.title.toLowerCase().includes(lowerQ))) {
      return songs;
    }
  }

  return CURATED_LIBRARY['hits-indonesia'] || [];
}

export interface SearchResultWrapper {
  songs: Song[];
  isCuratedFallback: boolean;
  error?: string;
}

export async function searchKaraokeSongs(
  query: string,
  suffix: SuffixFilter = 'karaoke',
  categoryId?: string
): Promise<SearchResultWrapper> {
  const trimmed = (query || '').trim();

  // If specific category selected with matching curated songs
  if (categoryId && (!trimmed || categoryId === 'hits-indonesia' || categoryId === 'naff-cakra' || categoryId === 'kerispatih-adaband' || categoryId === 'java-jive-nostalgia')) {
    const curated = CURATED_LIBRARY[categoryId];
    if (curated && curated.length > 0) {
      return {
        songs: curated,
        isCuratedFallback: true,
      };
    }
  }

  if (!trimmed) {
    const defaultSongs = (categoryId && CURATED_LIBRARY[categoryId]) || CURATED_LIBRARY['hits-indonesia'] || [];
    return {
      songs: defaultSongs,
      isCuratedFallback: true,
    };
  }

  try {
    const songs = await searchYouTube(trimmed, suffix);
    if (songs && songs.length > 0) {
      return {
        songs,
        isCuratedFallback: songs[0]?.isCurated ?? false,
      };
    }
  } catch (err: any) {
    return {
      songs: CURATED_LIBRARY['hits-indonesia'] || [],
      isCuratedFallback: true,
      error: 'Pencarian online dialihkan ke koleksi lagu favorit.',
    };
  }

  return {
    songs: CURATED_LIBRARY['hits-indonesia'] || [],
    isCuratedFallback: true,
  };
}
