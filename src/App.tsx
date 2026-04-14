import React, { useState, useEffect } from 'react';
import { 
  Search, Play, Pause, SkipBack, SkipForward, Volume2, 
  Music, KeyRound, AlertCircle, Loader2, Info, Home, 
  Library, Plus, Heart, Repeat, Shuffle, Mic2, ListMusic, 
  MonitorSpeaker, Maximize2, ChevronLeft, ChevronRight, User,
  Clock, ListPlus, Trash2, Sparkles
} from 'lucide-react';
import axios from 'axios';
import YouTube, { YouTubeProps } from 'react-youtube';

export interface Track {
  id: string; // YouTube Video ID
  title: string;
  artist: string;
  albumArt: string;
}

const CATEGORIES = [
  { id: 'top-hits', name: 'Top Hits Indonesia', query: 'Top Hits Indonesia official audio' },
  { id: 'pop-global', name: 'Global Pop', query: 'Global Pop Hits official audio' },
  { id: 'acoustic', name: 'Acoustic Relax', query: 'Acoustic cover relax' },
  { id: 'kpop', name: 'K-Pop Daebak', query: 'Kpop hits official audio' },
  { id: 'rock', name: 'Rock Classics', query: 'Classic Rock hits' },
  { id: 'lofi', name: 'Lofi Beats', query: 'Lofi hip hop beats to relax/study to' },
];

export default function App() {
  const [view, setView] = useState<'home' | 'search' | 'library' | 'queue' | 'playlist'>('home');
  const [query, setQuery] = useState('');
  const [activePlaylist, setActivePlaylist] = useState(CATEGORIES[0].name);
  
  const [viewTracks, setViewTracks] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<{id: string, name: string, tracks: Track[]}[]>(() => {
    try {
      const saved = localStorage.getItem('wiznify_playlists');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  
  const [likedTracks, setLikedTracks] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('wiznify_liked_tracks');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ytPlayer, setYtPlayer] = useState<any>(null);
  const [volume, setVolume] = useState(100);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);

  // @ts-ignore - Vite handles import.meta.env
  const apiKey = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_YOUTUBE_API_KEY : '';

  // Save liked tracks to local storage
  useEffect(() => {
    localStorage.setItem('wiznify_liked_tracks', JSON.stringify(likedTracks));
  }, [likedTracks]);

  useEffect(() => {
    localStorage.setItem('wiznify_playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    let interval: any;
    if (sleepTimer !== null && sleepTimer > 0) {
      interval = setInterval(() => {
        setSleepTimer(prev => {
          if (prev && prev <= 1) {
            if (ytPlayer) ytPlayer.pauseVideo();
            setIsPlaying(false);
            alert("Timer tidur selesai. Musik dihentikan.");
            return null;
          }
          return prev ? prev - 1 : null;
        });
      }, 60000);
    }
    return () => clearInterval(interval);
  }, [sleepTimer, ytPlayer]);

  const currentTrack = currentTrackIndex !== null && queue.length > 0 ? queue[currentTrackIndex] : null;

  const isLiked = currentTrack 
    ? likedTracks.some(t => t.id === currentTrack.id) 
    : false;

  const toggleLike = () => {
    if (!currentTrack) return;
    if (isLiked) {
      setLikedTracks(prev => prev.filter(t => t.id !== currentTrack.id));
    } else {
      setLikedTracks(prev => [...prev, currentTrack]);
    }
  };

  // Initial Load
  useEffect(() => {
    if (apiKey && view === 'home' && viewTracks.length === 0) {
      searchMusic(CATEGORIES[0].query, CATEGORIES[0].name);
    }
  }, [apiKey]);

  // Sync progress bar
  useEffect(() => {
    let interval: any;
    if (isPlaying && ytPlayer) {
      interval = setInterval(async () => {
        try {
          const time = await ytPlayer.getCurrentTime();
          const dur = await ytPlayer.getDuration();
          setProgress(time || 0);
          setDuration(dur || 0);
        } catch (e) {
          // Ignore errors if player is not ready
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, ytPlayer]);

  const searchMusic = async (searchTerm: string, playlistName: string = 'Search Results') => {
    if (!searchTerm || !apiKey) return;
    setIsLoading(true);
    setError(null);
    setActivePlaylist(playlistName);
    try {
      const response = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
        params: {
          part: 'snippet',
          maxResults: 24,
          q: searchTerm,
          type: 'video',
          videoCategoryId: '10', // Music category
          key: apiKey
        }
      });

      const results = response.data.items.map((item: any) => {
        const parser = new DOMParser();
        const decodedTitle = parser.parseFromString(item.snippet.title, 'text/html').body.textContent || item.snippet.title;
        
        // Clean up title (remove common YouTube suffixes)
        let cleanTitle = decodedTitle.replace(/(\(Official.*\)|\(Lyric.*\)|\(Music Video\)|\(Audio\)|\[Official.*\])/gi, '').trim();

        return {
          id: item.id.videoId,
          title: cleanTitle,
          artist: item.snippet.channelTitle.replace(/ - Topic/i, ''),
          albumArt: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
        };
      });
      setViewTracks(results);
    } catch (err: any) {
      console.error("Error fetching from YouTube:", err);
      if (err.response?.status === 403) {
        setError("API Key YouTube tidak valid atau kuota habis.");
      } else {
        setError("Gagal mengambil data dari YouTube. Periksa koneksi Anda.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchMusic(`${query} official audio OR lyric video`, `Search: ${query}`);
    }
  };

  const goToHome = () => {
    setView('home');
    if (viewTracks.length === 0 || activePlaylist === 'Search' || activePlaylist === 'Liked Songs' || activePlaylist === 'Antrian Lagu' || activePlaylist.startsWith('Playlist:')) {
      searchMusic(CATEGORIES[0].query, CATEGORIES[0].name);
    }
  };

  const goToSearch = () => {
    setView('search');
    setViewTracks([]);
    setActivePlaylist('Search');
    setQuery('');
  };

  const goToLibrary = () => {
    setView('library');
    setActivePlaylist('Liked Songs');
  };

  const goToQueue = () => {
    setView('queue');
    setActivePlaylist('Antrian Lagu');
  };

  const playTrack = (index: number, sourceTracks: Track[]) => {
    setQueue(sourceTracks);
    setCurrentTrackIndex(index);
  };

  const togglePlayPause = () => {
    if (!ytPlayer) {
      if (currentTrackIndex === null && queue.length > 0) {
        playTrack(0, queue);
      } else if (currentTrackIndex === null && viewTracks.length > 0) {
        playTrack(0, viewTracks);
      }
      return;
    }

    try {
      if (isPlaying) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    } catch (e) {
      console.error("Error toggling play/pause:", e);
    }
  };

  const playNext = () => {
    if (currentTrackIndex !== null) {
      if (repeatMode === 'one') {
        if (ytPlayer) {
          ytPlayer.seekTo(0, true);
          ytPlayer.playVideo();
        }
      } else if (currentTrackIndex < queue.length - 1) {
        setCurrentTrackIndex(currentTrackIndex + 1);
      } else if (repeatMode === 'all' && queue.length > 0) {
        setCurrentTrackIndex(0);
      }
    }
  };

  const playPrev = () => {
    if (currentTrackIndex !== null && currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1);
    } else if (repeatMode === 'all' && queue.length > 0) {
      setCurrentTrackIndex(queue.length - 1);
    }
  };

  const createPlaylist = () => {
    const name = prompt("Masukkan nama playlist baru:");
    if (name) {
      setPlaylists(prev => [...prev, { id: Date.now().toString(), name, tracks: [] }]);
    }
  };

  const addToPlaylistPrompt = (track: Track) => {
    if (playlists.length === 0) {
      alert("Belum ada playlist. Buat playlist dulu di Your Library.");
      return;
    }
    const text = "Pilih nomor playlist untuk menambahkan:\n" + playlists.map((p, i) => `${i+1}. ${p.name}`).join('\n');
    const res = prompt(text);
    const idx = parseInt(res || '') - 1;
    if (!isNaN(idx) && playlists[idx]) {
      setPlaylists(prev => prev.map(p => {
        if (p.id === playlists[idx].id) {
          if (!p.tracks.some(t => t.id === track.id)) {
            return { ...p, tracks: [...p.tracks, track] };
          }
        }
        return p;
      }));
      alert(`Ditambahkan ke playlist ${playlists[idx].name}`);
    }
  };

  const recommendSongs = () => {
    if (currentTrack) {
      setView('search');
      setQuery(currentTrack.artist);
      searchMusic(`${currentTrack.artist} official audio`, `Mungkin Anda Suka: ${currentTrack.artist}`);
    } else {
      alert("Putar lagu terlebih dahulu untuk mendapatkan rekomendasi.");
    }
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  };

  const promptSleepTimer = () => {
    if (sleepTimer) {
      const stop = confirm(`Timer tidur aktif (${sleepTimer} menit tersisa). Matikan timer?`);
      if (stop) setSleepTimer(null);
    } else {
      const mins = prompt("Masukkan waktu timer tidur (dalam menit):", "30");
      const parsed = parseInt(mins || '');
      if (!isNaN(parsed) && parsed > 0) {
        setSleepTimer(parsed);
        alert(`Timer tidur diatur untuk ${parsed} menit.`);
      }
    }
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
    if (currentTrackIndex === index) {
      playNext();
    } else if (currentTrackIndex !== null && currentTrackIndex > index) {
      setCurrentTrackIndex(currentTrackIndex - 1);
    }
  };

  // Media Session API for background controls
  useEffect(() => {
    if (currentTrackIndex !== null && queue[currentTrackIndex]) {
      const track = queue[currentTrackIndex];
      try {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: 'Wiznify',
            artwork: [
              { src: track.albumArt, sizes: '480x360', type: 'image/jpeg' }
            ]
          });

          navigator.mediaSession.setActionHandler('play', () => {
            try { ytPlayer?.playVideo(); } catch(e) {}
          });
          navigator.mediaSession.setActionHandler('pause', () => {
            try { ytPlayer?.pauseVideo(); } catch(e) {}
          });
          navigator.mediaSession.setActionHandler('previoustrack', playPrev);
          navigator.mediaSession.setActionHandler('nexttrack', playNext);
        }
      } catch (e) {
        console.error("MediaSession error:", e);
      }
    }
  }, [currentTrackIndex, queue, ytPlayer]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (ytPlayer) {
      try {
        ytPlayer.seekTo(time, true);
        setProgress(time);
      } catch (err) {
        console.error("Error seeking:", err);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (ytPlayer) {
      try {
        ytPlayer.setVolume(vol);
      } catch (err) {
        console.error("Error setting volume:", err);
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    try {
      setYtPlayer(event.target);
      event.target.setVolume(volume);
      event.target.playVideo();
    } catch (err) {
      console.error("Error in onPlayerReady:", err);
    }
  };

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    try {
      // 1 = playing, 2 = paused, 0 = ended
      if (event.data === 1) {
        setIsPlaying(true);
      } else if (event.data === 2) {
        setIsPlaying(false);
      } else if (event.data === 0) {
        playNext();
      }
    } catch (err) {
      console.error("Error in onPlayerStateChange:", err);
    }
  };

  // currentTrack moved up

  const opts: YouTubeProps['opts'] = {
    height: '1',
    width: '1',
    playerVars: {
      autoplay: 1,
      playsinline: 1,
      controls: 0,
      disablekb: 1,
    },
  };

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-xl max-w-2xl w-full shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6">
            <KeyRound size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-4">Setup YouTube API Key</h1>
          <p className="text-neutral-400 mb-6 text-lg">
            Wiznify membutuhkan YouTube API Key untuk mencari dan memutar lagu.
          </p>
          <div className="bg-black rounded-xl p-6 border border-neutral-800 mb-8">
            <h3 className="font-semibold text-emerald-400 mb-4 flex items-center gap-2">
              <Info size={20} /> Cara Mendapatkan API Key:
            </h3>
            <ol className="list-decimal list-inside space-y-3 text-neutral-300">
              <li>Buka <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">Google Cloud Console</a>.</li>
              <li>Buat <strong>Project Baru</strong>.</li>
              <li>Pilih menu <strong>APIs & Services</strong> &gt; <strong>Library</strong>.</li>
              <li>Cari <strong>YouTube Data API v3</strong> dan klik <strong>Enable</strong>.</li>
              <li>Pilih menu <strong>APIs & Services</strong> &gt; <strong>Credentials</strong>.</li>
              <li>Klik <strong>Create Credentials</strong> &gt; <strong>API Key</strong>.</li>
            </ol>
          </div>
          <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-6">
            <p className="text-neutral-300 mb-4">
              Buka menu <strong>Settings</strong> di AI Studio, pilih tab <strong>Secrets</strong>, tambahkan:
            </p>
            <div className="bg-black p-4 rounded-lg font-mono text-sm text-emerald-400">
              Key: VITE_YOUTUBE_API_KEY<br/>
              Value: [API Key Anda]
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black text-white flex flex-col font-sans overflow-hidden selection:bg-emerald-500/30">
      {/* Hidden YouTube Player */}
      <div className="absolute opacity-0 pointer-events-none">
        {currentTrack && (
          <YouTube 
            videoId={currentTrack.id} 
            opts={opts} 
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            onError={(e) => {
              console.error("YouTube Player Error:", e);
              playNext();
            }}
          />
        )}
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar (Desktop) */}
        <aside className="w-64 bg-black flex-col hidden md:flex">
          <div className="p-6">
            <div className="flex items-center gap-2 text-white font-bold text-2xl mb-8">
              <Music size={32} className="text-emerald-500" /> Wiznify
            </div>
            
            <nav className="flex flex-col gap-5">
              <button 
                onClick={goToHome}
                className={`flex items-center gap-4 font-semibold transition-colors ${view === 'home' ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
              >
                <Home size={24} /> Home
              </button>
              <button 
                onClick={goToSearch}
                className={`flex items-center gap-4 font-semibold transition-colors ${view === 'search' ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
              >
                <Search size={24} /> Search
              </button>
              <button 
                onClick={goToQueue}
                className={`flex items-center gap-4 font-semibold transition-colors ${view === 'queue' ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
              >
                <ListPlus size={24} /> Queue
              </button>
            </nav>
          </div>

          <div className="flex-1 bg-neutral-900/40 rounded-lg mx-2 mb-2 p-4 flex flex-col gap-4 overflow-y-auto">
            <div 
              onClick={goToLibrary}
              className={`flex items-center justify-between transition-colors cursor-pointer ${view === 'library' ? 'text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Library size={24} /> Your Library
              </div>
              <Plus size={20} onClick={(e) => { e.stopPropagation(); createPlaylist(); }} className="hover:text-white" />
            </div>
            
            <div className="mt-4 flex flex-col gap-3">
              {playlists.length > 0 ? (
                playlists.map(p => (
                  <div 
                    key={p.id}
                    onClick={() => {
                      setView('playlist');
                      setCurrentPlaylistId(p.id);
                      setActivePlaylist(`Playlist: ${p.name}`);
                      setViewTracks(p.tracks);
                    }}
                    className={`cursor-pointer truncate text-sm font-semibold transition-colors ${currentPlaylistId === p.id && view === 'playlist' ? 'text-emerald-500' : 'text-neutral-400 hover:text-white'}`}
                  >
                    {p.name}
                  </div>
                ))
              ) : (
                <div className="bg-neutral-800/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-1">Create your first playlist</h4>
                  <p className="text-xs text-neutral-400 mb-4">It's easy, we'll help you</p>
                  <button onClick={createPlaylist} className="bg-white text-black text-sm font-bold py-1.5 px-4 rounded-full hover:scale-105 transition-transform">
                    Create playlist
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-gradient-to-b from-neutral-800 to-neutral-950 flex flex-col overflow-hidden relative md:rounded-lg md:my-2 md:mr-2">
          
          {/* Topbar */}
          <header className="h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 bg-black/80 backdrop-blur-md">
            {/* Mobile Logo */}
            <div className="flex items-center gap-2 md:hidden text-white font-bold text-xl">
              <Music size={24} className="text-emerald-500" /> Wiznify
            </div>

            <div className="flex items-center gap-2 hidden md:flex">
              <button className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-neutral-400 hover:text-white">
                <ChevronLeft size={20} />
              </button>
              <button className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-neutral-400 hover:text-white">
                <ChevronRight size={20} />
              </button>
            </div>
            
            {view === 'search' && (
              <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md ml-0 md:ml-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What do you want to listen to?" 
                  className="w-full bg-neutral-800 hover:bg-neutral-700 border-transparent text-white rounded-full py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-white transition-all text-sm font-medium"
                />
              </form>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button className="bg-white text-black text-sm font-bold py-2 px-4 rounded-full hover:scale-105 transition-transform hidden sm:block">
                Explore Premium
              </button>
              <button className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-neutral-400 hover:text-white hover:scale-105 transition-transform">
                <User size={18} />
              </button>
            </div>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 pb-24">
            {view === 'home' && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-6">Good evening</h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                  {CATEGORIES.map((cat) => (
                    <div 
                      key={cat.id}
                      onClick={() => searchMusic(cat.query, cat.name)}
                      className="bg-neutral-800/50 hover:bg-neutral-700/50 transition-colors rounded-md flex items-center gap-4 cursor-pointer group overflow-hidden"
                    >
                      <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-900 flex items-center justify-center shadow-lg">
                        <Music size={24} className="text-white/80" />
                      </div>
                      <span className="font-semibold text-sm">{cat.name}</span>
                      <div className="ml-auto mr-4 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-black opacity-0 group-hover:opacity-100 shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all">
                        <Play size={20} fill="currentColor" className="ml-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === 'search' && viewTracks.length === 0 && !isLoading && !error && (
              <div className="text-center text-neutral-500 py-20">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-lg font-semibold text-white mb-2">Cari lagu favoritmu</p>
                <p className="text-sm">Ketik judul lagu atau nama artis di kolom pencarian atas.</p>
              </div>
            )}

            {view === 'queue' ? (
              <div>
                <div className="flex items-end justify-between mb-6">
                  <h2 className="text-2xl font-bold">Antrian Lagu</h2>
                  <span className="text-sm text-neutral-400 font-bold">{queue.length} songs</span>
                </div>
                {queue.length === 0 ? (
                  <div className="text-center text-neutral-500 py-20">
                    <ListPlus size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-semibold text-white mb-2">Antrian kosong</p>
                    <p className="text-sm">Putar lagu untuk menambahkannya ke antrian.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {queue.map((track, index) => (
                      <div 
                        key={`${track.id}-${index}`}
                        className={`flex items-center justify-between p-3 rounded-md hover:bg-neutral-800/50 group transition-colors ${currentTrackIndex === index ? 'bg-neutral-800/80' : ''}`}
                      >
                        <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setCurrentTrackIndex(index)}>
                          <div className="w-10 h-10 relative flex-shrink-0">
                            <img src={track.albumArt} alt={track.title} className="w-full h-full object-cover rounded" />
                            {currentTrackIndex === index && isPlaying && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-semibold text-sm truncate ${currentTrackIndex === index ? 'text-emerald-500' : 'text-white'}`}>{track.title}</h4>
                            <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeFromQueue(index)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-neutral-400 hover:text-white transition-all"
                          title="Hapus dari antrian"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : view === 'library' ? (
              <div>
                <div className="flex items-end justify-between mb-6">
                  <h2 className="text-2xl font-bold">Liked Songs</h2>
                  <span className="text-sm text-neutral-400 font-bold">{likedTracks.length} songs</span>
                </div>
                {likedTracks.length === 0 ? (
                  <div className="text-center text-neutral-500 py-20">
                    <Heart size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-semibold text-white mb-2">Belum ada lagu yang disukai</p>
                    <p className="text-sm">Klik ikon hati pada lagu untuk menyimpannya ke library.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {likedTracks.map((track, index) => (
                      <div 
                        key={track.id} 
                        onClick={() => playTrack(index, likedTracks)}
                        className="bg-neutral-900/40 hover:bg-neutral-800 p-4 rounded-md transition-all cursor-pointer group"
                      >
                        <div className="relative aspect-square mb-4 overflow-hidden rounded-md shadow-lg bg-neutral-800">
                          <img src={track.albumArt} alt={track.title} className="w-full h-full object-cover" />
                          <div className={`absolute bottom-2 right-2 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-black shadow-xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all ${currentTrack?.id === track.id && isPlaying ? 'opacity-100 translate-y-0' : ''}`}>
                            {currentTrack?.id === track.id && isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                          </div>
                        </div>
                        <h3 className="font-semibold text-base truncate text-white mb-1" title={track.title}>{track.title}</h3>
                        <p className="text-neutral-400 text-sm line-clamp-2" title={track.artist}>{track.artist}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : view === 'playlist' ? (
              <div>
                <div className="flex items-end justify-between mb-6">
                  <h2 className="text-2xl font-bold">{activePlaylist.replace('Playlist: ', '')}</h2>
                  <span className="text-sm text-neutral-400 font-bold">{viewTracks.length} songs</span>
                </div>
                {viewTracks.length === 0 ? (
                  <div className="text-center text-neutral-500 py-20">
                    <Music size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-semibold text-white mb-2">Playlist kosong</p>
                    <p className="text-sm">Cari lagu dan tambahkan ke playlist ini.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {viewTracks.map((track, index) => (
                      <div 
                        key={track.id} 
                        onClick={() => playTrack(index, viewTracks)}
                        className="bg-neutral-900/40 hover:bg-neutral-800 p-4 rounded-md transition-all cursor-pointer group relative"
                      >
                        <div className="relative aspect-square mb-4 overflow-hidden rounded-md shadow-lg bg-neutral-800">
                          <img src={track.albumArt} alt={track.title} className="w-full h-full object-cover" />
                          <div className={`absolute bottom-2 right-2 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-black shadow-xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all ${currentTrack?.id === track.id && isPlaying ? 'opacity-100 translate-y-0' : ''}`}>
                            {currentTrack?.id === track.id && isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                          </div>
                        </div>
                        <h3 className="font-semibold text-base truncate text-white mb-1" title={track.title}>{track.title}</h3>
                        <p className="text-neutral-400 text-sm line-clamp-2" title={track.artist}>{track.artist}</p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlaylists(prev => prev.map(p => {
                              if (p.id === currentPlaylistId) {
                                return { ...p, tracks: p.tracks.filter(t => t.id !== track.id) };
                              }
                              return p;
                            }));
                            setViewTracks(prev => prev.filter(t => t.id !== track.id));
                          }}
                          className="absolute top-2 right-2 p-2 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"
                          title="Hapus dari playlist"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {view !== 'search' || viewTracks.length > 0 ? (
                  <div className="flex items-end justify-between mb-6">
                    <h2 className="text-2xl font-bold hover:underline cursor-pointer">{activePlaylist}</h2>
                    {viewTracks.length > 0 && <span className="text-sm text-neutral-400 font-bold hover:underline cursor-pointer">Show all</span>}
                  </div>
                ) : null}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-center gap-3 mb-6">
                    <AlertCircle size={20} />
                    <p>{error}</p>
                  </div>
                )}

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-emerald-500">
                    <Loader2 size={48} className="animate-spin mb-4" />
                  </div>
                ) : viewTracks.length === 0 && !error && view !== 'search' ? (
                  <div className="text-center text-neutral-500 py-20">
                    <Search size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No tracks found</p>
                  </div>
                ) : viewTracks.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {viewTracks.map((track, index) => (
                      <div 
                        key={track.id} 
                        onClick={() => playTrack(index, viewTracks)}
                        className="bg-neutral-900/40 hover:bg-neutral-800 p-4 rounded-md transition-all cursor-pointer group relative"
                      >
                        <div className="relative aspect-square mb-4 overflow-hidden rounded-md shadow-lg bg-neutral-800">
                          <img src={track.albumArt} alt={track.title} className="w-full h-full object-cover" />
                          <div className={`absolute bottom-2 right-2 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-black shadow-xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all ${currentTrack?.id === track.id && isPlaying ? 'opacity-100 translate-y-0' : ''}`}>
                            {currentTrack?.id === track.id && isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                          </div>
                        </div>
                        <h3 className="font-semibold text-base truncate text-white mb-1" title={track.title}>{track.title}</h3>
                        <p className="text-neutral-400 text-sm line-clamp-2" title={track.artist}>{track.artist}</p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            addToPlaylistPrompt(track);
                          }}
                          className="absolute top-2 right-2 p-2 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 hover:bg-emerald-500 hover:text-black transition-all"
                          title="Tambah ke playlist"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Spotify-style Bottom Player */}
      <div className="h-[90px] bg-black border-t border-neutral-800 px-4 flex items-center justify-between z-50 relative">
        
        {/* Left: Track Info */}
        <div className="flex items-center gap-4 w-[30%] min-w-[180px]">
          {currentTrack ? (
            <>
              <img src={currentTrack.albumArt} alt="Album Art" className="w-14 h-14 rounded object-cover shadow-md" />
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-white text-sm truncate hover:underline cursor-pointer">{currentTrack.title}</h4>
                <p className="text-xs text-neutral-400 truncate hover:underline cursor-pointer">{currentTrack.artist}</p>
              </div>
              <button 
                onClick={toggleLike} 
                className={`ml-2 hover:scale-105 transition-transform ${isLiked ? 'text-emerald-500' : 'text-neutral-400 hover:text-white'}`}
              >
                <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
              </button>
              <button 
                onClick={() => addToPlaylistPrompt(currentTrack)} 
                className="ml-2 text-neutral-400 hover:text-white transition-transform hover:scale-105"
                title="Tambah ke playlist"
              >
                <Plus size={16} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4 opacity-50">
              <div className="w-14 h-14 bg-neutral-800 rounded flex items-center justify-center">
                <Music size={20} className="text-neutral-500" />
              </div>
            </div>
          )}
        </div>

        {/* Center: Controls */}
        <div className="flex flex-col items-center w-[40%] max-w-[722px]">
          <div className="flex items-center gap-4 md:gap-6 mb-1">
            <button 
              onClick={recommendSongs}
              className="text-neutral-400 hover:text-emerald-500 transition-colors hidden sm:block"
              title="Rekomendasi Lagu"
            >
              <Sparkles size={16} />
            </button>
            <button onClick={playPrev} className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50" disabled={!currentTrack}>
              <SkipBack size={20} fill="currentColor" />
            </button>
            <button 
              onClick={togglePlayPause}
              disabled={!currentTrack}
              className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={playNext} className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50" disabled={!currentTrack}>
              <SkipForward size={20} fill="currentColor" />
            </button>
            <button 
              onClick={toggleRepeat}
              className={`transition-colors hidden sm:flex items-center justify-center relative ${repeatMode !== 'off' ? 'text-emerald-500' : 'text-neutral-400 hover:text-white'}`}
              title={`Repeat: ${repeatMode}`}
            >
              <Repeat size={16} />
              {repeatMode === 'one' && <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-black rounded-full w-3 h-3 flex items-center justify-center">1</span>}
            </button>
          </div>
          
          <div className="w-full flex items-center gap-2 text-[11px] text-neutral-400 font-medium">
            <span className="min-w-[40px] text-right">{formatTime(progress)}</span>
            <div className="group flex-1 relative flex items-center h-3 cursor-pointer">
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={progress} 
                onChange={handleSeek}
                className="absolute w-full h-1 bg-neutral-600 rounded-full appearance-none z-10 opacity-0 cursor-pointer"
              />
              <div className="w-full h-1 bg-neutral-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white group-hover:bg-emerald-500 transition-colors" 
                  style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
                />
              </div>
              <div 
                className="absolute h-3 w-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity z-0"
                style={{ left: `calc(${duration ? (progress / duration) * 100 : 0}% - 6px)` }}
              />
            </div>
            <span className="min-w-[40px]">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Extra Controls */}
        <div className="w-[30%] flex justify-end items-center gap-3 text-neutral-400 hidden md:flex">
          <button 
            onClick={promptSleepTimer}
            className={`hover:text-white transition-colors relative ${sleepTimer ? 'text-emerald-500' : ''}`}
            title={sleepTimer ? `Timer tidur: ${sleepTimer}m` : "Set timer tidur"}
          >
            <Clock size={16} />
            {sleepTimer && <span className="absolute -top-2 -right-2 text-[9px] font-bold">{sleepTimer}</span>}
          </button>
          <button 
            onClick={goToQueue}
            className={`hover:text-white transition-colors ${view === 'queue' ? 'text-emerald-500' : ''}`}
            title="Antrian"
          >
            <ListMusic size={16} />
          </button>
          <div className="flex items-center gap-2 w-24 group">
            <Volume2 size={16} className="hover:text-white cursor-pointer" />
            <div className="relative flex-1 flex items-center h-3 cursor-pointer">
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={volume}
                onChange={handleVolumeChange}
                className="absolute w-full h-1 bg-neutral-600 rounded-full appearance-none z-10 opacity-0 cursor-pointer"
              />
              <div className="w-full h-1 bg-neutral-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white group-hover:bg-emerald-500 transition-colors" 
                  style={{ width: `${volume}%` }}
                />
              </div>
              <div 
                className="absolute h-3 w-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity z-0"
                style={{ left: `calc(${volume}% - 6px)` }}
              />
            </div>
          </div>
          <Maximize2 size={16} className="hover:text-white cursor-pointer ml-2" />
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden h-16 bg-gradient-to-t from-black to-black/90 flex items-center justify-around px-4 border-t border-neutral-900 z-50">
        <button 
          onClick={goToHome}
          className={`flex flex-col items-center gap-1 ${view === 'home' ? 'text-white' : 'text-neutral-400'}`}
        >
          <Home size={24} />
          <span className="text-[10px]">Home</span>
        </button>
        <button 
          onClick={goToSearch}
          className={`flex flex-col items-center gap-1 ${view === 'search' ? 'text-white' : 'text-neutral-400'}`}
        >
          <Search size={24} />
          <span className="text-[10px]">Search</span>
        </button>
        <button 
          onClick={goToLibrary}
          className={`flex flex-col items-center gap-1 ${view === 'library' || view === 'playlist' ? 'text-white' : 'text-neutral-400'}`}
        >
          <Library size={24} />
          <span className="text-[10px]">Library</span>
        </button>
        <button 
          onClick={goToQueue}
          className={`flex flex-col items-center gap-1 ${view === 'queue' ? 'text-white' : 'text-neutral-400'}`}
        >
          <ListPlus size={24} />
          <span className="text-[10px]">Queue</span>
        </button>
      </div>
    </div>
  );
}
