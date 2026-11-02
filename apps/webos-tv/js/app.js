/**
 * StreamOS Live - LG webOS IPTV Player Core Engine
 * Cinematic Lumina 10-Foot UI Implementation with Hls.js MSE decoding & Supabase Cloud Sync
 */

(function () {
  'use strict';

  // Remote Control Key Codes
  const KEYS = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    ENTER: 13,
    BACK_WEBOS: 461,
    BACK_ESC: 27,
    BACK_BS: 8,
    BACK_SMART: 10009,
    CH_UP: 33,
    CH_DOWN: 34,
    PLAY: 415,
    PAUSE: 19,
    STOP: 413,
    REWIND: 412,
    FAST_FORWARD: 417,
    // LG Remote 4 Color Keys
    COLOR_RED: 403,
    COLOR_GREEN: 404,
    COLOR_YELLOW: 405,
    COLOR_BLUE: 406,
  };

  // Safe HTML Escaping
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDurationHMS(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00:00';
    const sec = Math.floor(seconds);
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  // Configuration (from window.IPTV_CONFIG or localStorage)
  const config = window.IPTV_CONFIG || {};

  // State
  const state = {
    supabaseUrl: localStorage.getItem('iptv_supabase_url') || config.supabaseUrl || 'https://qzwunvyrozubfgwlkenh.supabase.co',
    supabaseKey: localStorage.getItem('iptv_supabase_key') || config.supabaseAnonKey || '',
    serverUrl: localStorage.getItem('iptv_server_url') || 'http://192.168.18.7:3001',
    deviceToken: localStorage.getItem('iptv_device_token') || '',
    deviceId: getOrCreateDeviceId(),
    currentView: 'hub', // 'hub' | 'catalog' | 'player' | 'epg' | 'server'
    currentContentType: 'live', // 'live' | 'movies' | 'series' | 'favorites'
    hubIndex: 0, // 0: live, 1: movies, 2: series, 3: favorites
    navTabIndex: 0, // 0: hub, 1: catalog, 2: player, 3: epg, 4: server
    focusSection: 'hub', // 'hub' | 'tabs' | 'categories' | 'channels' | 'inspector' | 'pagination' | 'player' | 'epg' | 'server'
    inspectorFocusIndex: 0, // 0: Watch Fullscreen, 1: Favorite Button
    paginationFocusIndex: 0, // 0: Prev, 1: Next
    epgFocusIndex: 0,
    serverFocusIndex: 0,
    categoryIndex: 0,
    channelIndex: 0,
    catalogPage: 1,
    catalogTotalCount: 0,
    catalogTotalPages: 1,
    catalogLimit: 20,
    catalogSearch: '',
    groups: [],
    channels: [],
    epgChannels: [],
    watchProgressMap: {}, // channel_id -> { position_seconds, duration_seconds }
    selectedChannel: null,
    currentPlayingIndex: -1,
    isOnlyFavorites: false,
    hudTimeout: null,
    numericBuffer: '',
    numericTimeout: null,
    pipDebounceTimeout: null,
    searchDebounceTimeout: null,
    lastProgressSaveTime: 0,
  };

  let hlsInstance = null;
  let pipHlsInstance = null;
  let streamTimeout = null;
  let hlsNetworkRetryCount = 0;

  function getOrCreateDeviceId() {
    let id = localStorage.getItem('iptv_device_id');
    if (!id) {
      id = 'tv_lg_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('iptv_device_id', id);
    }
    return id;
  }

  // DOM Elements Cache
  const dom = {
    headerServerIp: document.getElementById('header-server-ip'),
    headerPing: document.getElementById('header-ping'),
    liveClock: document.getElementById('live-clock'),
    liveDate: document.getElementById('live-date'),
    categoryRail: document.getElementById('category-rail'),
    currentCategoryTitle: document.getElementById('current-category-title'),
    activeListBadge: document.getElementById('active-list-badge'),
    channelCounter: document.getElementById('channel-counter'),
    channelsMatrix: document.getElementById('channels-matrix'),
    catalogPageLabel: document.getElementById('catalog-page-label'),
    catalogPrevBtn: document.getElementById('catalog-prev-btn'),
    catalogNextBtn: document.getElementById('catalog-next-btn'),
    catalogSearchInput: document.getElementById('catalog-search-input'),
    catalogSearchClear: document.getElementById('catalog-search-clear'),
    numericDisplay: document.getElementById('numeric-input-display'),
    // Hub Elements (First Screen)
    viewHub: document.getElementById('view-hub'),
    hubCardLive: document.getElementById('hub-card-live'),
    hubCardMovies: document.getElementById('hub-card-movies'),
    hubCardSeries: document.getElementById('hub-card-series'),
    hubCardFavorites: document.getElementById('hub-card-favorites'),
    hubCountLive: document.getElementById('hub-count-live'),
    hubCountMovies: document.getElementById('hub-count-movies'),
    hubCountSeries: document.getElementById('hub-count-series'),
    hubCountFavorites: document.getElementById('hub-count-favorites'),
    navCatalogLabel: document.getElementById('nav-catalog-label'),
    navCatalogIcon: document.getElementById('nav-catalog-icon'),
    // Views
    viewCatalog: document.getElementById('view-catalog'),
    viewPlayer: document.getElementById('view-player'),
    viewEpg: document.getElementById('view-epg'),
    viewServer: document.getElementById('view-server'),
    // Player
    videoPlayer: document.getElementById('video-player'),
    playerHudOverlay: document.getElementById('player-hud-overlay'),
    playerHudNum: document.getElementById('player-hud-num'),
    playerHudName: document.getElementById('player-hud-name'),
    playerHudGroup: document.getElementById('player-hud-group'),
    playerHudEpgTitle: document.getElementById('player-hud-epg-title'),
    playerHudEpgTime: document.getElementById('player-hud-epg-time'),
    playerHudClock: document.getElementById('player-hud-clock'),
    playerFavIcon: document.getElementById('player-fav-icon'),
    playerPlayPauseIcon: document.getElementById('player-play-pause-icon'),
    playerVodProgressBox: document.getElementById('player-vod-progress-box'),
    playerVodCurrentTime: document.getElementById('player-vod-current-time'),
    playerVodDuration: document.getElementById('player-vod-duration'),
    playerVodProgressFill: document.getElementById('player-vod-progress-fill'),
    // Inspector & PiP
    pipVideoPlayer: document.getElementById('pip-video-player'),
    pipFallbackImg: document.getElementById('pip-fallback-img'),
    pipFallbackText: document.getElementById('pip-fallback-text'),
    pipChNum: document.getElementById('pip-ch-num'),
    inspectorName: document.getElementById('inspector-name'),
    inspectorGroup: document.getElementById('inspector-group'),
    inspectorFavBtn: document.getElementById('inspector-fav-btn'),
    inspectorFavIcon: document.getElementById('inspector-fav-icon'),
    inspectorEpgTitle: document.getElementById('inspector-epg-title'),
    inspectorEpgTime: document.getElementById('inspector-epg-time'),
    inspectorEpgDesc: document.getElementById('inspector-epg-desc'),
    btnWatchFullscreen: document.getElementById('btn-watch-fullscreen'),
    // Overlays
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingOverlayText: document.getElementById('loading-overlay-text'),
    errorOverlay: document.getElementById('error-overlay'),
    errorOverlayDesc: document.getElementById('error-overlay-desc'),
    // Server View
    setupServerInput: document.getElementById('setup-server-input'),
    setupPinInput: document.getElementById('setup-pin-input'),
    setupErrorMsg: document.getElementById('setup-error-msg'),
    epgTimelineContainer: document.getElementById('epg-timeline-container'),
  };

  // Clock
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${mins}`;

    if (dom.liveClock) dom.liveClock.textContent = timeStr;
    if (dom.playerHudClock) dom.playerHudClock.textContent = timeStr;

    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;
    if (dom.liveDate) dom.liveDate.textContent = dateStr;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Supabase Rest Helper
  async function fetchFromSupabase(endpoint, options = {}) {
    const url = `${state.supabaseUrl}/rest/v1/${endpoint}`;
    const headers = {
      'apikey': state.supabaseKey,
      'Authorization': `Bearer ${state.supabaseKey}`,
      ...(options.headers || {})
    };
    return fetch(url, { ...options, headers });
  }

  // Load Live Counts for the 4 Hub Cards (Uses RPC get_iptv_counts with fallback)
  async function loadHubCounts() {
    try {
      const t0 = performance.now();
      const rpcRes = await fetchFromSupabase('rpc/get_iptv_counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });

      if (rpcRes.ok) {
        const stats = await rpcRes.json();
        const pingMs = Math.round(performance.now() - t0);
        if (dom.headerPing) dom.headerPing.textContent = `${pingMs}ms`;
        if (dom.hubCountLive) dom.hubCountLive.textContent = `${(stats.live || 0).toLocaleString('pt-BR')} canais`;
        if (dom.hubCountMovies) dom.hubCountMovies.textContent = `${(stats.movies || 0).toLocaleString('pt-BR')} filmes`;
        if (dom.hubCountSeries) dom.hubCountSeries.textContent = `${(stats.series || 0).toLocaleString('pt-BR')} séries`;
        if (dom.hubCountFavorites) dom.hubCountFavorites.textContent = `${(stats.favorites || 0).toLocaleString('pt-BR')} salvos`;
        return;
      }

      const fetchCount = async (type) => {
        let ep = `iptv_channels?is_hidden=eq.false&select=count`;
        if (type === 'favorites') ep += `&is_favorite=eq.true`;
        else if (type) ep += `&content_type=eq.${type}`;
        const r = await fetchFromSupabase(ep, { headers: { 'Prefer': 'count=exact' } });
        if (r.ok) {
          const range = r.headers.get('content-range');
          if (range) return parseInt(range.split('/')[1], 10) || 0;
        }
        return 0;
      };

      const [cLive, cMovies, cSeries, cFav] = await Promise.all([
        fetchCount('live'),
        fetchCount('movies'),
        fetchCount('series'),
        fetchCount('favorites'),
      ]);

      if (dom.hubCountLive) dom.hubCountLive.textContent = `${cLive.toLocaleString('pt-BR')} canais`;
      if (dom.hubCountMovies) dom.hubCountMovies.textContent = `${cMovies.toLocaleString('pt-BR')} filmes`;
      if (dom.hubCountSeries) dom.hubCountSeries.textContent = `${cSeries.toLocaleString('pt-BR')} séries`;
      if (dom.hubCountFavorites) dom.hubCountFavorites.textContent = `${cFav.toLocaleString('pt-BR')} salvos`;
    } catch (err) {
      console.warn('Erro ao carregar contagens do Hub:', err);
    }
  }

  // Load Watch Progress Map from Supabase (for Continue Watching in Movies/Series)
  async function loadWatchProgressMap() {
    try {
      const res = await fetchFromSupabase('iptv_watch_progress?select=channel_id,position_seconds,duration_seconds&limit=200');
      if (res.ok) {
        const rows = await res.json();
        const map = {};
        rows.forEach(r => {
          map[r.channel_id] = {
            position: r.position_seconds || 0,
            duration: r.duration_seconds || 0
          };
        });
        state.watchProgressMap = map;
      }
    } catch (e) {
      console.warn('Aviso ao carregar progresso de VOD:', e);
    }
  }

  async function saveWatchProgress(channelId, contentType, positionSec, durationSec) {
    if (!channelId || positionSec < 5) return;
    const pos = Math.floor(positionSec);
    const dur = Math.floor(durationSec || 0);
    state.watchProgressMap[channelId] = { position: pos, duration: dur };

    try {
      await fetchFromSupabase('iptv_watch_progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          channel_id: channelId,
          content_type: contentType || 'movies',
          position_seconds: pos,
          duration_seconds: dur,
          completed: dur > 0 && (pos / dur) > 0.92
        })
      });
    } catch (e) {
      console.warn('Aviso ao salvar progresso:', e);
    }
  }

  // Clear all visual focus rings across sections
  function clearAllSectionFocusRings() {
    document.querySelectorAll('.nav-tab-btn, .hub-card, .category-pill, .channel-matrix-card, #btn-watch-fullscreen, #inspector-fav-btn, #catalog-prev-btn, #catalog-next-btn, .epg-row-item').forEach(el => {
      el.classList.remove('focused', 'focus-tv-active', 'neon-pulse');
    });
  }

  // Top Navigation Tabs Focus Highlighting
  function updateTabsFocus() {
    clearAllSectionFocusRings();
    const btns = Array.from(document.querySelectorAll('.nav-tab-btn'));
    const target = btns[state.navTabIndex];
    if (target) {
      target.classList.add('focused', 'focus-tv-active');
    }
  }

  // Hub Card Focus Highlighting
  function updateHubFocus() {
    clearAllSectionFocusRings();
    const cards = [
      dom.hubCardLive,
      dom.hubCardMovies,
      dom.hubCardSeries,
      dom.hubCardFavorites
    ];
    cards.forEach((c, idx) => {
      if (!c) return;
      if (idx === state.hubIndex && state.focusSection === 'hub') {
        c.classList.add('focused', 'focus-tv-active');
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  // Select Mode from Hub (Live TV, Movies, Series, Favorites)
  async function selectHubMode(mode) {
    state.currentContentType = mode;
    state.isOnlyFavorites = mode === 'favorites';
    state.catalogPage = 1;
    state.categoryIndex = 1; // Default to 'Todos' pill
    state.channelIndex = 0;
    state.catalogSearch = '';
    if (dom.catalogSearchInput) dom.catalogSearchInput.value = '';
    if (dom.catalogSearchClear) dom.catalogSearchClear.classList.add('hidden');

    let title = 'Catálogo de TV Ao Vivo';
    let icon = 'live_tv';
    if (mode === 'movies') {
      title = 'Catálogo de Filmes (VOD)';
      icon = 'movie';
    } else if (mode === 'series') {
      title = 'Catálogo de Séries (VOD)';
      icon = 'video_library';
    } else if (mode === 'favorites') {
      title = 'Meus Favoritos';
      icon = 'star';
      state.categoryIndex = 0;
    }

    if (dom.currentCategoryTitle) dom.currentCategoryTitle.textContent = title;
    if (dom.navCatalogLabel) dom.navCatalogLabel.textContent = title.replace('Catálogo de ', '');
    if (dom.navCatalogIcon) dom.navCatalogIcon.textContent = icon;
    updateActiveFilterBadge();

    showLoading(true, `Carregando ${title}...`);
    switchToView('catalog');

    await Promise.all([
      loadGroupsForContentType(mode),
      mode !== 'live' ? loadWatchProgressMap() : Promise.resolve()
    ]);
    renderCategoryRail();
    await loadCatalogChannels();
    showLoading(false);
  }

  function updateActiveFilterBadge() {
    if (!dom.activeListBadge) return;
    if (state.isOnlyFavorites || state.currentContentType === 'favorites') {
      dom.activeListBadge.textContent = '⭐ Só Favoritos';
      dom.activeListBadge.className = 'text-xs font-label-tech text-[#ffcc00] bg-[#ffcc00]/15 px-2.5 py-0.5 rounded border border-[#ffcc00]/40 font-bold';
    } else if (state.catalogSearch) {
      dom.activeListBadge.textContent = `🔍 "${state.catalogSearch}"`;
      dom.activeListBadge.className = 'text-xs font-label-tech text-tertiary bg-tertiary/15 px-2.5 py-0.5 rounded border border-tertiary/40 font-bold';
    } else {
      const label = state.currentContentType === 'live' ? 'TV Ao Vivo' : (state.currentContentType === 'movies' ? 'Filmes VOD' : 'Séries VOD');
      dom.activeListBadge.textContent = label;
      dom.activeListBadge.className = 'text-xs font-label-tech text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/30';
    }
  }

  // Load Groups for specific content type (Uses RPC get_iptv_groups to avoid 1000-row cut)
  async function loadGroupsForContentType(mode) {
    try {
      const rpcRes = await fetchFromSupabase('rpc/get_iptv_groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_content_type: (mode && mode !== 'favorites') ? mode : null,
          p_only_favorites: mode === 'favorites' || state.isOnlyFavorites
        })
      });

      if (rpcRes.ok) {
        const dynamicGroups = await rpcRes.json();
        const totalSum = dynamicGroups.reduce((acc, g) => acc + Number(g.count || 0), 0);
        state.groups = [
          { name: 'Todos', count: totalSum },
          ...dynamicGroups.map(g => ({ name: g.name, count: Number(g.count || 0) }))
        ];
        return;
      }

      // Fallback REST query if RPC not yet created
      let endpoint = `iptv_channels?is_hidden=eq.false&select=group_title`;
      if (mode !== 'favorites') {
        endpoint += `&content_type=eq.${mode}`;
      } else {
        endpoint += `&is_favorite=eq.true`;
      }

      const res = await fetchFromSupabase(endpoint);
      if (res.ok) {
        const rows = await res.json();
        const counts = {};
        rows.forEach(r => {
          const g = (r.group_title || 'Geral').trim();
          counts[g] = (counts[g] || 0) + 1;
        });
        const dynamicGroups = Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        state.groups = [
          { name: 'Todos', count: rows.length },
          ...dynamicGroups
        ];
        return;
      }
    } catch (e) {
      console.warn('Erro ao buscar grupos do Supabase:', e);
    }

    // Fallback: grupos do servidor local
    try {
      const res = await fetch(`${state.serverUrl}/api/groups`);
      if (res.ok) {
        const data = await res.json();
        state.groups = data.groups || [];
      }
    } catch {
      state.groups = [{ name: 'Todos', count: 0 }];
    }
  }

  // Initialization
  async function init() {
    setupEventListeners();
    setupVideoPlayer();

    if (dom.headerServerIp) {
      dom.headerServerIp.textContent = 'Supabase Cloud';
    }

    switchToView('hub');
  }

  // Clean up full-screen and PiP players safely
  function cleanupAllPlayers() {
    if (streamTimeout) {
      clearTimeout(streamTimeout);
      streamTimeout = null;
    }
    if (state.pipDebounceTimeout) {
      clearTimeout(state.pipDebounceTimeout);
      state.pipDebounceTimeout = null;
    }
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    if (pipHlsInstance) {
      pipHlsInstance.destroy();
      pipHlsInstance = null;
    }
    if (dom.videoPlayer) {
      dom.videoPlayer.pause();
      dom.videoPlayer.removeAttribute('src');
      dom.videoPlayer.load();
    }
    if (dom.pipVideoPlayer) {
      dom.pipVideoPlayer.pause();
      dom.pipVideoPlayer.removeAttribute('src');
      dom.pipVideoPlayer.load();
    }
  }

  function stopPipPreview() {
    if (state.pipDebounceTimeout) {
      clearTimeout(state.pipDebounceTimeout);
      state.pipDebounceTimeout = null;
    }
    if (pipHlsInstance) {
      pipHlsInstance.destroy();
      pipHlsInstance = null;
    }
    if (dom.pipVideoPlayer) {
      dom.pipVideoPlayer.pause();
      dom.pipVideoPlayer.removeAttribute('src');
      dom.pipVideoPlayer.load();
    }
    if (dom.pipFallbackImg) {
      dom.pipFallbackImg.style.display = 'flex';
    }
  }

  // View Switcher
  function switchToView(viewName) {
    if (state.currentView === 'player' && viewName !== 'player') {
      cleanupAllPlayers();
    } else if (viewName !== 'catalog') {
      stopPipPreview();
    }

    state.currentView = viewName;
    const viewOrder = ['hub', 'catalog', 'player', 'epg', 'server'];
    const tabIdx = viewOrder.indexOf(viewName);
    if (tabIdx !== -1) state.navTabIndex = tabIdx;

    // Update Nav Tabs UI
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.remove('text-primary', 'border-b-2', 'border-primary', 'font-bold', 'shadow-[0_4px_12px_rgba(0,210,255,0.25)]');
      btn.classList.add('text-on-surface-variant', 'font-medium');
    });

    const activeBtn = document.getElementById(`nav-btn-${viewName}`);
    if (activeBtn) {
      activeBtn.classList.remove('text-on-surface-variant', 'font-medium');
      activeBtn.classList.add('text-primary', 'border-b-2', 'border-primary', 'font-bold', 'shadow-[0_4px_12px_rgba(0,210,255,0.25)]');
    }

    // Hide all views
    if (dom.viewHub) dom.viewHub.classList.add('hidden');
    dom.viewCatalog.classList.add('hidden');
    dom.viewPlayer.classList.add('hidden');
    dom.viewEpg.classList.add('hidden');
    dom.viewServer.classList.add('hidden');

    if (viewName === 'hub') {
      if (dom.viewHub) dom.viewHub.classList.remove('hidden');
      state.focusSection = 'hub';
      updateHubFocus();
      loadHubCounts();
    } else if (viewName === 'catalog') {
      dom.viewCatalog.classList.remove('hidden');
      state.focusSection = 'channels';
      updateChannelFocus();
    } else if (viewName === 'player') {
      dom.viewPlayer.classList.remove('hidden');
      state.focusSection = 'player';
      showPlayerHud();
    } else if (viewName === 'epg') {
      dom.viewEpg.classList.remove('hidden');
      state.focusSection = 'epg';
      loadEpgTimeline();
    } else if (viewName === 'server') {
      dom.viewServer.classList.remove('hidden');
      state.focusSection = 'server';
      updateServerViewFocus();
    }
  }

  // Load Initial Server Data (Local Server fallback)
  async function loadInitialData() {
    showLoading(true, 'Sincronizando com o Servidor Local...');
    const t0 = performance.now();
    try {
      const headers = { 'Authorization': `Bearer ${state.deviceToken}` };

      const statusRes = await fetch(`${state.serverUrl}/api/status`, { headers });
      const pingMs = Math.round(performance.now() - t0);
      if (dom.headerPing) dom.headerPing.textContent = `${pingMs}ms`;

      const groupRes = await fetch(`${state.serverUrl}/api/groups`, { headers });
      if (!groupRes.ok) throw new Error('Não autorizado');
      const groupData = await groupRes.json();
      state.groups = groupData.groups || [];

      renderCategoryRail();
      await loadCatalogChannels();
      showLoading(false);
      switchToView('catalog');
    } catch (err) {
      showLoading(false);
      console.warn('Falha ao autenticar com servidor local:', err);
      switchToView('server');
    }
  }

  // Category Rail
  function renderCategoryRail() {
    dom.categoryRail.innerHTML = '';

    // Item 0: Favoritos
    const favBtn = document.createElement('button');
    favBtn.className = 'category-pill flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high/90 text-on-surface border border-outline-variant/40 text-sm font-label-lg transition-all focusable shrink-0';
    favBtn.dataset.type = 'fav';
    favBtn.innerHTML = `
      <span class="material-symbols-outlined text-[#ffcc00] text-[20px]" style="font-variation-settings: 'FILL' 1;">star</span>
      <span>Favoritos</span>
    `;
    dom.categoryRail.appendChild(favBtn);

    // Dynamic Groups (First item is 'Todos' from state.groups)
    state.groups.filter(g => !g.isHidden).forEach(g => {
      const gBtn = document.createElement('button');
      gBtn.className = 'category-pill flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high/70 text-on-surface border border-outline-variant/30 text-sm font-label-lg transition-all focusable shrink-0';
      gBtn.dataset.type = g.name === 'Todos' ? 'all' : 'group';
      gBtn.dataset.name = g.name;
      gBtn.innerHTML = `
        <span>${escapeHtml(g.name)}</span>
        <span class="text-xs font-label-tech text-on-surface-variant bg-surface-container-lowest px-2 py-0.5 rounded-full">${Number(g.count || 0).toLocaleString('pt-BR')}</span>
      `;
      dom.categoryRail.appendChild(gBtn);
    });

    updateCategorySelection();
  }

  function updateCategorySelection() {
    const pills = dom.categoryRail.querySelectorAll('.category-pill');
    pills.forEach((pill, idx) => {
      const isSelected = idx === state.categoryIndex;
      const isFocusedSection = state.focusSection === 'categories' && isSelected;
      if (isSelected) {
        pill.classList.add('bg-primary-container', 'text-on-primary-container', 'border-2', 'border-primary-fixed', 'font-bold', 'scale-105', 'shadow-[0_0_16px_rgba(0,210,255,0.4)]');
        pill.classList.remove('bg-surface-container-high/70', 'bg-surface-container-high/90', 'text-on-surface', 'border-outline-variant/30', 'border-outline-variant/40');
        pill.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      } else {
        pill.classList.remove('bg-primary-container', 'text-on-primary-container', 'border-2', 'border-primary-fixed', 'font-bold', 'scale-105', 'shadow-[0_0_16px_rgba(0,210,255,0.4)]');
        pill.classList.add('bg-surface-container-high/70', 'text-on-surface', 'border-outline-variant/30');
      }
      pill.classList.toggle('focus-tv-active', isFocusedSection);
    });
  }

  async function selectCategory(idx) {
    const pills = dom.categoryRail.querySelectorAll('.category-pill');
    if (idx < 0 || idx >= pills.length) return;
    state.categoryIndex = idx;
    updateCategorySelection();
    state.catalogPage = 1;
    await loadCatalogChannels();
  }

  // Search inside TV Catalog
  function onCatalogSearchInput(val) {
    const clean = (val || '').trim();
    if (dom.catalogSearchClear) {
      dom.catalogSearchClear.classList.toggle('hidden', !clean);
    }
    if (state.searchDebounceTimeout) clearTimeout(state.searchDebounceTimeout);
    state.searchDebounceTimeout = setTimeout(() => {
      state.catalogSearch = clean;
      state.catalogPage = 1;
      updateActiveFilterBadge();
      loadCatalogChannels();
    }, 350);
  }

  function clearCatalogSearch() {
    state.catalogSearch = '';
    if (dom.catalogSearchInput) dom.catalogSearchInput.value = '';
    if (dom.catalogSearchClear) dom.catalogSearchClear.classList.add('hidden');
    state.catalogPage = 1;
    updateActiveFilterBadge();
    loadCatalogChannels();
  }

  // Load Channels with Pagination
  async function loadCatalogChannels() {
    const pills = dom.categoryRail.querySelectorAll('.category-pill');
    const selectedPill = pills[state.categoryIndex];
    const groupName = selectedPill?.dataset?.name;
    const isFav = selectedPill?.dataset?.type === 'fav' || state.isOnlyFavorites || state.currentContentType === 'favorites';

    const offset = (state.catalogPage - 1) * state.catalogLimit;

    // 1. Try Supabase
    try {
      let query = `iptv_channels?is_hidden=eq.false&order=sort_order.asc,id.asc&offset=${offset}&limit=${state.catalogLimit}`;
      if (isFav) {
        query += '&is_favorite=eq.true';
      }
      if (state.currentContentType && state.currentContentType !== 'favorites') {
        query += `&content_type=eq.${state.currentContentType}`;
      }
      if (groupName && groupName !== 'Todos') {
        query += `&group_title=eq.${encodeURIComponent(groupName)}`;
      }
      if (state.catalogSearch) {
        query += `&name=ilike.*${encodeURIComponent(state.catalogSearch)}*`;
      }

      const res = await fetchFromSupabase(query, {
        headers: { 'Prefer': 'count=exact' }
      });

      if (res.ok) {
        const totalHeader = res.headers.get('content-range');
        const totalCount = totalHeader ? parseInt(totalHeader.split('/')[1], 10) || 0 : 0;
        const rows = await res.json();

        state.channels = rows.map(c => ({
          id: c.id,
          name: c.name,
          url: c.stream_url,
          logoUrl: c.logo_url,
          groupTitle: c.group_title,
          isFavorite: c.is_favorite,
          tvgId: c.tvg_id,
          tvgName: c.tvg_name,
          contentType: c.content_type || state.currentContentType,
          seriesName: c.series_name,
          seasonNumber: c.season_number,
          episodeNumber: c.episode_number,
          originalName: c.original_name,
        }));

        state.catalogTotalCount = totalCount;
        state.catalogTotalPages = Math.max(1, Math.ceil(totalCount / state.catalogLimit));
        dom.channelCounter.innerHTML = `Exibindo <span class="text-primary font-bold">${totalCount.toLocaleString('pt-BR')}</span> itens`;
        dom.catalogPageLabel.textContent = `Página ${state.catalogPage} de ${state.catalogTotalPages}`;

        dom.catalogPrevBtn.disabled = state.catalogPage <= 1;
        dom.catalogNextBtn.disabled = state.catalogPage >= state.catalogTotalPages;

        state.channelIndex = Math.min(state.channelIndex, Math.max(0, state.channels.length - 1));
        renderChannelsMatrix();
        return;
      }
    } catch (err) {
      console.warn('Falha na consulta ao Supabase, tentando servidor local:', err);
    }

    // 2. Fallback to Local Server
    try {
      const headers = { 'Authorization': `Bearer ${state.deviceToken}` };
      const params = new URLSearchParams({
        page: state.catalogPage,
        limit: state.catalogLimit,
      });

      if (isFav) params.append('favorites', 'true');
      if (groupName && groupName !== 'Todos') params.append('group', groupName);
      if (state.catalogSearch) params.append('search', state.catalogSearch);

      const res = await fetch(`${state.serverUrl}/api/channels?${params.toString()}`, { headers });
      const data = await res.json();

      state.channels = data.channels || [];
      state.catalogTotalCount = data.total || state.channels.length;
      state.catalogTotalPages = data.totalPages || 1;
      dom.channelCounter.innerHTML = `Exibindo <span class="text-primary font-bold">${state.catalogTotalCount}</span> canais`;
      dom.catalogPageLabel.textContent = `Página ${state.catalogPage} de ${state.catalogTotalPages}`;

      dom.catalogPrevBtn.disabled = state.catalogPage <= 1;
      dom.catalogNextBtn.disabled = state.catalogPage >= state.catalogTotalPages;

      state.channelIndex = 0;
      renderChannelsMatrix();
    } catch (e) {
      console.error('Falha em ambos os provedores (Supabase e Servidor Local):', e);
    }
  }

  function changeCatalogPage(delta) {
    const newPage = state.catalogPage + delta;
    if (newPage >= 1 && newPage <= state.catalogTotalPages) {
      state.catalogPage = newPage;
      state.channelIndex = 0;
      loadCatalogChannels();
    }
  }

  // Render 2-Column Channel Cards Matrix
  function renderChannelsMatrix() {
    dom.channelsMatrix.innerHTML = '';

    if (state.channels.length === 0) {
      dom.channelsMatrix.innerHTML = `
        <div class="col-span-2 text-center py-16 text-on-surface-variant font-label-tech">
          <span class="material-symbols-outlined text-5xl mb-2 text-outline">tv_off</span>
          <p>Nenhum item encontrado para este filtro.</p>
        </div>
      `;
      updateInspectorDetails(null);
      return;
    }

    state.channels.forEach((ch, idx) => {
      const card = document.createElement('div');
      const isFocused = state.focusSection === 'channels' && idx === state.channelIndex;
      card.className = `channel-matrix-card relative rounded-xl p-3 flex flex-col justify-between transition-all duration-150 cursor-pointer border ${isFocused ? 'focus-tv-active bg-surface-container border-2 border-primary-container neon-pulse' : 'bg-surface-container-low/90 border-outline-variant/30 hover:border-primary/50'}`;
      card.dataset.index = idx;

      const chNumber = String((state.catalogPage - 1) * state.catalogLimit + idx + 1).padStart(3, '0');
      const starIcon = ch.isFavorite
        ? `<span class="material-symbols-outlined text-[#ffcc00] text-[20px]" style="font-variation-settings: 'FILL' 1;">star</span>`
        : '';

      const safeName = escapeHtml(ch.name);
      const safeGroup = escapeHtml(ch.groupTitle || 'Geral');
      const safeLogo = ch.logoUrl ? escapeHtml(ch.logoUrl) : '';
      const isVod = ch.contentType === 'movies' || ch.contentType === 'series';

      const logoImg = safeLogo
        ? `<img src="${safeLogo}" loading="lazy" class="${isVod ? 'w-11 h-14 object-cover' : 'w-10 h-10 object-contain'} rounded-lg bg-surface-container-highest p-0.5 shrink-0" onerror="this.outerHTML='<div class=\\'w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-xs font-bold font-label-tech text-primary shrink-0\\'>${chNumber}</div>'"/>`
        : `<div class="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-xs font-bold font-label-tech text-primary shrink-0">${chNumber}</div>`;

      const badgeTag = ch.contentType === 'movies'
        ? 'VOD FILME'
        : (ch.contentType === 'series'
            ? (ch.seasonNumber ? `T${String(ch.seasonNumber).padStart(2,'0')}E${String(ch.episodeNumber || 1).padStart(2,'0')}` : 'SÉRIE')
            : 'AO VIVO');

      const prog = state.watchProgressMap[ch.id];
      const pctWatched = (prog && prog.duration > 0) ? Math.min(100, Math.round((prog.position / prog.duration) * 100)) : (isVod ? 0 : 100);
      const subText = isVod
        ? (prog && prog.position > 10 ? `Continuar em ${formatDurationHMS(prog.position)}` : (ch.seriesName ? escapeHtml(ch.seriesName) : 'Disponível sob demanda'))
        : escapeHtml(ch.tvgName || 'Transmissão Ao Vivo');

      card.innerHTML = `
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2.5 min-w-0">
            ${logoImg}
            <div class="min-w-0">
              <h3 class="text-sm font-headline-sm font-bold text-white truncate max-w-[185px]">${safeName}</h3>
              <span class="text-[11px] font-label-tech text-on-surface-variant truncate block">${safeGroup}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${starIcon}
            <span class="text-[10px] font-label-tech bg-surface-container-highest px-1.5 py-0.5 rounded border border-outline-variant/40 text-on-surface">${badgeTag}</span>
          </div>
        </div>
        <div class="mt-2.5 pt-2 border-t border-outline-variant/20">
          <div class="text-[11px] text-on-surface-variant font-label-tech truncate flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full ${isVod ? 'bg-primary' : 'bg-secondary-container'} shrink-0"></span>
            <span class="truncate">${subText}</span>
          </div>
          ${pctWatched > 0 ? `
          <div class="w-full bg-surface-container-highest h-1 rounded-full mt-1.5 overflow-hidden">
            <div class="bg-primary h-full rounded-full" style="width: ${pctWatched}%;"></div>
          </div>` : ''}
        </div>
      `;
      dom.channelsMatrix.appendChild(card);
    });

    updateChannelFocus();
  }

  function updateChannelFocus() {
    clearAllSectionFocusRings();
    const cards = dom.channelsMatrix.querySelectorAll('.channel-matrix-card');
    cards.forEach((card, idx) => {
      if (idx === state.channelIndex) {
        if (state.focusSection === 'channels') {
          card.classList.add('focus-tv-active', 'bg-surface-container', 'border-2', 'border-primary-container', 'neon-pulse');
          card.classList.remove('bg-surface-container-low/90', 'border-outline-variant/30');
        }
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        updateInspectorDetails(state.channels[idx] || null);
      } else {
        card.classList.remove('focus-tv-active', 'bg-surface-container', 'border-2', 'border-primary-container', 'neon-pulse');
        card.classList.add('bg-surface-container-low/90', 'border-outline-variant/30');
      }
    });
  }

  function updateInspectorFocus() {
    clearAllSectionFocusRings();
    if (state.inspectorFocusIndex === 0 && dom.btnWatchFullscreen) {
      dom.btnWatchFullscreen.classList.add('focused', 'focus-tv-active');
    } else if (state.inspectorFocusIndex === 1 && dom.inspectorFavBtn) {
      dom.inspectorFavBtn.classList.add('focused', 'focus-tv-active');
    }
  }

  function updatePaginationFocus() {
    clearAllSectionFocusRings();
    if (state.paginationFocusIndex === 0 && dom.catalogPrevBtn) {
      dom.catalogPrevBtn.classList.add('focused', 'focus-tv-active');
    } else if (state.paginationFocusIndex === 1 && dom.catalogNextBtn) {
      dom.catalogNextBtn.classList.add('focused', 'focus-tv-active');
    }
  }

  // Update Right Inspector Panel & Trigger Debounced PiP / Poster Preview
  function updateInspectorDetails(channel) {
    const previousChannelId = state.selectedChannel?.id;
    state.selectedChannel = channel;

    if (!channel) {
      stopPipPreview();
      dom.inspectorName.textContent = 'Nenhum conteúdo';
      dom.inspectorGroup.textContent = '';
      dom.pipFallbackText.textContent = 'Selecione um item na lista';
      return;
    }

    const num = String((state.catalogPage - 1) * state.catalogLimit + state.channelIndex + 1).padStart(3, '0');
    const isVod = channel.contentType === 'movies' || channel.contentType === 'series';

    dom.inspectorName.textContent = `${num} ${channel.name}`;
    dom.inspectorGroup.textContent = `${channel.groupTitle} · ${isVod ? 'Catálogo Sob Demanda (VOD)' : 'Transmissão Ao Vivo'}`;
    dom.pipChNum.textContent = isVod ? 'VOD' : `CH ${num}`;

    if (channel.isFavorite) {
      dom.inspectorFavIcon.textContent = 'star';
      dom.inspectorFavIcon.classList.add('text-[#ffcc00]');
    } else {
      dom.inspectorFavIcon.textContent = 'star_border';
      dom.inspectorFavIcon.classList.remove('text-[#ffcc00]');
    }

    const prog = state.watchProgressMap[channel.id];
    if (isVod) {
      dom.inspectorEpgTime.textContent = prog && prog.position > 10 ? `Retomar em ${formatDurationHMS(prog.position)}` : 'Sob Demanda';
      dom.inspectorEpgTitle.textContent = channel.seriesName
        ? `${channel.seriesName} — Temp. ${channel.seasonNumber || 1}, Ep. ${channel.episodeNumber || 1}`
        : channel.name;
      dom.inspectorEpgDesc.textContent = `Pressione [OK] no controle remoto para assistir em tela cheia com avanço/retrocesso rápido.`;
    } else {
      dom.inspectorEpgTime.textContent = 'Ao Vivo';
      dom.inspectorEpgTitle.textContent = channel.tvgName || 'Programação Ao Vivo';
      dom.inspectorEpgDesc.textContent = `Sinal ao vivo do canal ${channel.name}. Pressione [OK] para tela cheia.`;
      if (channel.tvgId) {
        fetchLiveEpgForInspector(channel.tvgId);
      }
    }

    // Handle PiP Video Preview or VOD Poster Display
    if (previousChannelId !== channel.id) {
      stopPipPreview();

      if (isVod && channel.logoUrl) {
        dom.pipFallbackImg.innerHTML = `
          <img src="${escapeHtml(channel.logoUrl)}" class="w-full h-full object-contain bg-black" onerror="this.style.display='none'"/>
        `;
      } else {
        dom.pipFallbackImg.innerHTML = `
          <span class="material-symbols-outlined text-5xl text-primary/60 mb-2">tv</span>
          <span id="pip-fallback-text" class="text-sm font-label-tech text-on-surface-variant">Pressione [OK] para assistir ${escapeHtml(channel.name)}</span>
        `;
      }

      // Start muted Live TV preview in PiP box after 1.3s of resting focus on a live channel
      if (!isVod && dom.pipVideoPlayer) {
        state.pipDebounceTimeout = setTimeout(() => {
          if (state.currentView === 'catalog' && state.selectedChannel && state.selectedChannel.id === channel.id) {
            startPipStream(channel);
          }
        }, 1300);
      }
    }
  }

  async function fetchLiveEpgForInspector(tvgId) {
    try {
      const nowIso = new Date().toISOString();
      const res = await fetchFromSupabase(
        `iptv_epg_programmes?channel_tvg_id=eq.${encodeURIComponent(tvgId)}&stop_time=gte.${encodeURIComponent(nowIso)}&order=start_time.asc&limit=1`
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0 && state.selectedChannel && state.selectedChannel.tvgId === tvgId) {
          const p = rows[0];
          const startD = new Date(p.start_time);
          const stopD = new Date(p.stop_time);
          const timeRange = `${String(startD.getHours()).padStart(2,'0')}:${String(startD.getMinutes()).padStart(2,'0')} - ${String(stopD.getHours()).padStart(2,'0')}:${String(stopD.getMinutes()).padStart(2,'0')}`;
          dom.inspectorEpgTime.textContent = timeRange;
          dom.inspectorEpgTitle.textContent = p.title;
          if (p.description) dom.inspectorEpgDesc.textContent = p.description;
        }
      }
    } catch {
      // Ignore silent EPG lookup errors
    }
  }

  function startPipStream(channel) {
    if (!dom.pipVideoPlayer || !channel || !channel.url) return;
    const strategy = detectStreamStrategy(channel.url, channel.contentType);

    dom.pipVideoPlayer.muted = true;
    if (window.Hls && Hls.isSupported() && strategy.engine === 'hls') {
      pipHlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 5,
        maxBufferLength: 10,
        maxMaxBufferLength: 15,
        manifestLoadingTimeOut: 8000,
      });
      pipHlsInstance.loadSource(strategy.url);
      pipHlsInstance.attachMedia(dom.pipVideoPlayer);
      pipHlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        if (dom.pipFallbackImg) dom.pipFallbackImg.style.display = 'none';
        dom.pipVideoPlayer.play().catch(() => {});
      });
      pipHlsInstance.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          stopPipPreview();
        }
      });
    }
  }

  // Stream Format & Protocol Detection Strategy
  function detectStreamStrategy(rawUrl, contentType) {
    const url = (rawUrl || '').trim();
    const lower = url.toLowerCase();

    // 1. Direct container files (.mp4, .mkv, .avi, .mov, .webm) -> Native Hardware Decoder
    if (/\.(mp4|mkv|avi|mov|webm)(\?.*)?$/i.test(lower)) {
      return { engine: 'native', url, fallbackNativeUrl: null };
    }

    // 2. Xtream Codes .ts live stream -> Try .m3u8 HLS first, fallback to native .ts
    if (lower.endsWith('.ts')) {
      return {
        engine: 'hls',
        url: url.replace(/\.ts$/i, '.m3u8'),
        fallbackNativeUrl: url
      };
    }

    // 3. Explicit .m3u8 manifest
    if (lower.includes('.m3u8')) {
      return { engine: 'hls', url, fallbackNativeUrl: url };
    }

    // 4. General URL without extension
    if (contentType === 'movies' || contentType === 'series') {
      return { engine: 'native', url, fallbackNativeUrl: null };
    }

    return { engine: 'hls', url, fallbackNativeUrl: url };
  }

  // Watch Fullscreen
  function watchSelectedFullscreen() {
    if (!state.selectedChannel) return;
    playChannelByObject(state.selectedChannel, state.channelIndex);
  }

  // Video Player Logic with Hls.js + Native Hardware Fallback + VOD Scrubber
  function setupVideoPlayer() {
    const v = dom.videoPlayer;

    const onPlaying = () => {
      if (streamTimeout) {
        clearTimeout(streamTimeout);
        streamTimeout = null;
      }
      showLoading(false);
      showPlayerHud();
      if (dom.playerPlayPauseIcon) dom.playerPlayPauseIcon.textContent = 'pause';
    };

    v.addEventListener('playing', onPlaying);
    v.addEventListener('canplay', onPlaying);

    v.addEventListener('loadedmetadata', () => {
      const ch = state.selectedChannel;
      if (ch && (ch.contentType === 'movies' || ch.contentType === 'series')) {
        const saved = state.watchProgressMap[ch.id];
        if (saved && saved.position > 15 && v.duration && saved.position < v.duration - 30) {
          v.currentTime = saved.position;
        }
      }
    });

    v.addEventListener('timeupdate', () => {
      if (v.currentTime > 0) showLoading(false);

      const ch = state.selectedChannel;
      const isVod = ch && (ch.contentType === 'movies' || ch.contentType === 'series');
      if (isVod && v.duration && isFinite(v.duration) && v.duration > 0) {
        if (dom.playerVodCurrentTime) dom.playerVodCurrentTime.textContent = formatDurationHMS(v.currentTime);
        if (dom.playerVodDuration) dom.playerVodDuration.textContent = formatDurationHMS(v.duration);
        if (dom.playerVodProgressFill) {
          const pct = Math.min(100, (v.currentTime / v.duration) * 100);
          dom.playerVodProgressFill.style.width = `${pct}%`;
        }

        // Save watch progress every 15 seconds
        const now = Date.now();
        if (now - state.lastProgressSaveTime > 15000) {
          state.lastProgressSaveTime = now;
          saveWatchProgress(ch.id, ch.contentType, v.currentTime, v.duration);
        }
      }
    });

    v.addEventListener('waiting', () => {
      if (v.currentTime === 0) showLoading(true, 'Carregando buffer do stream...');
    });

    v.addEventListener('error', () => {
      if (streamTimeout) clearTimeout(streamTimeout);
      showLoading(false);
      const code = v.error ? v.error.code : 'Desconhecido';
      console.warn('Native video error:', code);
      if (!hlsInstance) {
        showError(`Não foi possível reproduzir este conteúdo.\n(Código de mídia: ${code})\nVerifique se o stream está online.`);
      }
    });
  }

  function playChannelByObject(channel, index) {
    if (!channel) return;

    cleanupAllPlayers();
    hlsNetworkRetryCount = 0;

    state.currentPlayingIndex = index;
    state.selectedChannel = channel;

    const isVod = channel.contentType === 'movies' || channel.contentType === 'series';
    const num = String((state.catalogPage - 1) * state.catalogLimit + index + 1).padStart(3, '0');

    dom.playerHudNum.textContent = isVod ? 'VOD' : `CH ${num}`;
    dom.playerHudName.textContent = channel.name;
    dom.playerHudGroup.textContent = channel.groupTitle;
    dom.playerHudEpgTitle.textContent = isVod
      ? (channel.seriesName ? `${channel.seriesName} (T${channel.seasonNumber || 1} E${channel.episodeNumber || 1})` : 'Catálogo VOD')
      : (channel.tvgName || 'Transmissão Ao Vivo');
    dom.playerHudEpgTime.textContent = isVod ? 'Sob Demanda' : 'Ao Vivo';

    if (dom.playerVodProgressBox) {
      dom.playerVodProgressBox.classList.toggle('hidden', !isVod);
    }

    if (channel.isFavorite) {
      dom.playerFavIcon.textContent = 'star';
      dom.playerFavIcon.classList.add('text-[#ffcc00]');
    } else {
      dom.playerFavIcon.textContent = 'star_border';
      dom.playerFavIcon.classList.remove('text-[#ffcc00]');
    }

    switchToView('player');
    showLoading(true, `Sintonizando ${channel.name}...`);
    showPlayerHud();

    // 18 seconds watchdog
    streamTimeout = setTimeout(() => {
      showLoading(false);
      showError(`O stream '${channel.name}' demorou mais de 18 segundos para responder.\nVerifique se o canal está ativo no provedor.`);
    }, 18000);

    const strategy = detectStreamStrategy(channel.url, channel.contentType);

    if (window.Hls && Hls.isSupported() && strategy.engine === 'hls') {
      try {
        // Memory-safe Hls.js configuration tailored for LG webOS ARM TVs
        hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 15,
          maxBufferLength: 20,
          maxMaxBufferLength: 45,
          maxBufferSize: 35 * 1000 * 1000, // 35 MB max MSE buffer
          maxBufferHole: 0.5,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 2,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 2,
          fragLoadingTimeOut: 15000,
          fragLoadingMaxRetry: 3,
        });

        hlsInstance.loadSource(strategy.url);
        hlsInstance.attachMedia(dom.videoPlayer);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          dom.videoPlayer.muted = false;
          dom.videoPlayer.play().catch(err => {
            console.warn('Autoplay retry:', err);
            dom.videoPlayer.play().catch(e => console.warn('Play retry failed:', e));
          });
        });

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
          console.warn('HLS Event Error:', data.type, data.details, data.fatal);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hlsNetworkRetryCount++;
                if (hlsNetworkRetryCount <= 2) {
                  hlsInstance.startLoad();
                } else if (strategy.fallbackNativeUrl) {
                  console.log('Fallback do Hls.js para player nativo webOS:', strategy.fallbackNativeUrl);
                  hlsInstance.destroy();
                  hlsInstance = null;
                  dom.videoPlayer.src = strategy.fallbackNativeUrl;
                  dom.videoPlayer.play().catch(e => console.warn(e));
                } else {
                  if (streamTimeout) clearTimeout(streamTimeout);
                  showLoading(false);
                  showError(`Falha de rede na transmissão (${data.details || 'Offline'}).`);
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hlsInstance.recoverMediaError();
                break;
              default:
                if (strategy.fallbackNativeUrl) {
                  hlsInstance.destroy();
                  hlsInstance = null;
                  dom.videoPlayer.src = strategy.fallbackNativeUrl;
                  dom.videoPlayer.play().catch(e => console.warn(e));
                } else {
                  if (streamTimeout) clearTimeout(streamTimeout);
                  showLoading(false);
                  showError(`Falha na transmissão: ${data.details || 'Stream indisponível'}`);
                }
                break;
            }
          }
        });
      } catch (hlsErr) {
        console.warn('HLS.js fallback para nativo:', hlsErr);
        dom.videoPlayer.src = strategy.url;
        dom.videoPlayer.play().catch(e => console.warn(e));
      }
    } else {
      dom.videoPlayer.muted = false;
      dom.videoPlayer.src = strategy.url;
      dom.videoPlayer.play().catch(err => console.warn(err));
    }
  }

  function seekVod(deltaSeconds) {
    const v = dom.videoPlayer;
    if (!v || !v.duration || !isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration - 2, v.currentTime + deltaSeconds));
    showPlayerHud();
  }

  function onVodScrubberClick(e) {
    const v = dom.videoPlayer;
    if (!v || !v.duration || !isFinite(v.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    v.currentTime = pct * v.duration;
    showPlayerHud();
  }

  function playNextChannel() {
    if (state.channels.length === 0) return;
    const nextIdx = (state.currentPlayingIndex + 1) % state.channels.length;
    playChannelByObject(state.channels[nextIdx], nextIdx);
  }

  function playPrevChannel() {
    if (state.channels.length === 0) return;
    const prevIdx = (state.currentPlayingIndex - 1 + state.channels.length) % state.channels.length;
    playChannelByObject(state.channels[prevIdx], prevIdx);
  }

  function togglePlayPause() {
    if (dom.videoPlayer.paused) {
      dom.videoPlayer.play();
      if (dom.playerPlayPauseIcon) dom.playerPlayPauseIcon.textContent = 'pause';
    } else {
      dom.videoPlayer.pause();
      if (dom.playerPlayPauseIcon) dom.playerPlayPauseIcon.textContent = 'play_arrow';
    }
    showPlayerHud();
  }

  function showPlayerHud() {
    dom.playerHudOverlay.classList.add('visible');
    if (state.hudTimeout) clearTimeout(state.hudTimeout);
    state.hudTimeout = setTimeout(() => {
      dom.playerHudOverlay.classList.remove('visible');
    }, 5000);
  }

  function stopPlayerAndReturn() {
    const ch = state.selectedChannel;
    const v = dom.videoPlayer;
    if (ch && (ch.contentType === 'movies' || ch.contentType === 'series') && v && v.currentTime > 10) {
      saveWatchProgress(ch.id, ch.contentType, v.currentTime, v.duration);
    }
    cleanupAllPlayers();
    showLoading(false);
    switchToView('catalog');
  }

  // Favorite Toggles (Fixed BUG-01: Updates Supabase directly + Local Server fallback)
  async function toggleInspectorFavorite() {
    if (!state.selectedChannel) return;
    const ch = state.selectedChannel;
    const newFav = !ch.isFavorite;

    // Optimistic UI update
    ch.isFavorite = newFav;
    renderChannelsMatrix();

    try {
      const res = await fetchFromSupabase(`iptv_channels?id=eq.${encodeURIComponent(ch.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: newFav }),
      });
      if (!res.ok) throw new Error(`Supabase HTTP ${res.status}`);
      loadHubCounts();
    } catch (supaErr) {
      console.warn('Fallback para servidor local ao favoritar:', supaErr);
      try {
        await fetch(`${state.serverUrl}/api/channels/${encodeURIComponent(ch.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isFavorite: newFav }),
        });
      } catch (localErr) {
        console.error('Erro ao salvar favorito:', localErr);
      }
    }
  }

  async function toggleCurrentPlayingFavorite() {
    if (!state.selectedChannel) return;
    await toggleInspectorFavorite();
    if (dom.playerFavIcon) {
      dom.playerFavIcon.textContent = state.selectedChannel.isFavorite ? 'star' : 'star_border';
      dom.playerFavIcon.classList.toggle('text-[#ffcc00]', state.selectedChannel.isFavorite);
    }
  }

  // Overlays
  function showLoading(show, message) {
    if (show) {
      dom.loadingOverlay.style.display = 'flex';
      if (dom.loadingOverlayText && message) dom.loadingOverlayText.textContent = message;
    } else {
      dom.loadingOverlay.style.display = 'none';
    }
  }

  function showError(msg) {
    dom.errorOverlayDesc.innerText = msg;
    dom.errorOverlay.style.display = 'flex';
  }

  function hideError() {
    dom.errorOverlay.style.display = 'none';
    stopPlayerAndReturn();
  }

  function retryCurrentChannel() {
    dom.errorOverlay.style.display = 'none';
    if (state.selectedChannel) {
      playChannelByObject(state.selectedChannel, state.currentPlayingIndex);
    }
  }

  // Guia EPG Timeline View (Fixed BUG-02 & BUG-11: Loads from Supabase + D-Pad Navigation)
  async function loadEpgTimeline() {
    dom.epgTimelineContainer.innerHTML = '<div class="text-center text-on-surface-variant font-label-tech py-12">Carregando guia de programação do Supabase...</div>';
    try {
      let chList = [];
      const supaRes = await fetchFromSupabase('iptv_channels?content_type=eq.live&is_hidden=eq.false&order=sort_order.asc&limit=30');
      if (supaRes.ok) {
        const rows = await supaRes.json();
        chList = rows.map(c => ({
          id: c.id,
          name: c.name,
          url: c.stream_url,
          logoUrl: c.logo_url,
          groupTitle: c.group_title,
          isFavorite: c.is_favorite,
          tvgId: c.tvg_id,
          tvgName: c.tvg_name,
          contentType: 'live'
        }));
      }

      if (chList.length === 0) {
        dom.epgTimelineContainer.innerHTML = '<div class="text-center text-on-surface-variant font-label-tech py-12">Nenhum canal ao vivo disponível para o guia.</div>';
        return;
      }

      state.epgChannels = chList;
      state.epgFocusIndex = 0;

      // Lookup current programmes from iptv_epg_programmes
      const epgMap = {};
      try {
        const nowIso = new Date().toISOString();
        const epgRes = await fetchFromSupabase(`iptv_epg_programmes?stop_time=gte.${encodeURIComponent(nowIso)}&order=start_time.asc&limit=200`);
        if (epgRes.ok) {
          const progs = await epgRes.json();
          progs.forEach(p => {
            if (!epgMap[p.channel_tvg_id]) {
              epgMap[p.channel_tvg_id] = p;
            }
          });
        }
      } catch {
        // Optional table
      }

      dom.epgTimelineContainer.innerHTML = `
        <div class="flex flex-col gap-3">
          ${chList.map((c, i) => {
            const prog = c.tvgId ? epgMap[c.tvgId] : null;
            let timeLabel = 'Ao Vivo Agora · Transmissão Contínua';
            let titleLabel = c.tvgName || c.name;
            if (prog) {
              const s = new Date(prog.start_time);
              const e = new Date(prog.stop_time);
              timeLabel = `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')} - ${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`;
              titleLabel = prog.title;
            }
            return `
            <div class="epg-row-item flex items-center gap-4 bg-surface-container-low p-3 rounded-xl border border-outline-variant/30 focusable hover:border-primary cursor-pointer" data-epg-index="${i}" onclick="playEpgChannel(${i})">
              <div class="w-56 shrink-0 flex items-center gap-3">
                <span class="text-primary font-bold font-label-tech">${String(i + 1).padStart(3, '0')}</span>
                <span class="font-bold text-white truncate">${escapeHtml(c.name)}</span>
              </div>
              <div class="flex-1 bg-surface-container px-4 py-2 rounded-lg border border-outline-variant/20 flex justify-between items-center">
                <div>
                  <div class="text-sm font-semibold text-[#ffcc00]">${escapeHtml(titleLabel)}</div>
                  <div class="text-xs text-on-surface-variant font-label-tech">${escapeHtml(timeLabel)}</div>
                </div>
                <span class="text-xs font-label-tech bg-primary-container text-on-primary-container px-2.5 py-1 rounded font-bold">ASSISTIR ▶</span>
              </div>
            </div>
          `}).join('')}
        </div>
      `;

      updateEpgFocus();
    } catch (err) {
      dom.epgTimelineContainer.innerHTML = `<div class="text-center text-error font-label-tech py-12">Falha ao carregar EPG: ${escapeHtml(err.message)}</div>`;
    }
  }

  function updateEpgFocus() {
    clearAllSectionFocusRings();
    const rows = dom.epgTimelineContainer.querySelectorAll('.epg-row-item');
    rows.forEach((r, idx) => {
      if (idx === state.epgFocusIndex && state.focusSection === 'epg') {
        r.classList.add('focused', 'focus-tv-active');
        r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  function playEpgChannel(idx) {
    const ch = state.epgChannels[idx];
    if (ch) {
      playChannelByObject(ch, idx);
    }
  }

  function updateServerViewFocus() {
    clearAllSectionFocusRings();
    const els = dom.viewServer.querySelectorAll('.focusable');
    const target = els[state.serverFocusIndex];
    if (target) {
      target.classList.add('focused', 'focus-tv-active');
      if (target.tagName === 'INPUT') target.focus();
    }
  }

  // Server Setup Confirmation
  async function confirmSetupPairing() {
    const server = dom.setupServerInput.value.trim().replace(/\/$/, '');
    const pin = dom.setupPinInput.value.trim();

    if (!pin || pin.length !== 6) {
      dom.setupErrorMsg.textContent = 'Digite o PIN de 6 dígitos gerado no painel web.';
      dom.setupErrorMsg.classList.remove('hidden');
      return;
    }

    showLoading(true, 'Pareando com servidor local...');
    try {
      const res = await fetch(`${server}/api/devices/pair/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          deviceId: state.deviceId,
          deviceName: 'LG webOS TV (Cinematic Lumina)',
        }),
      });

      const data = await res.json();
      showLoading(false);

      if (res.ok && data.token) {
        state.serverUrl = server;
        state.deviceToken = data.token;
        localStorage.setItem('iptv_server_url', server);
        localStorage.setItem('iptv_device_token', data.token);

        dom.setupErrorMsg.classList.add('hidden');
        await loadInitialData();
      } else {
        dom.setupErrorMsg.textContent = data.error || 'PIN incorreto ou expirado';
        dom.setupErrorMsg.classList.remove('hidden');
      }
    } catch (err) {
      showLoading(false);
      dom.setupErrorMsg.textContent = 'Falha ao conectar: ' + err.message;
      dom.setupErrorMsg.classList.remove('hidden');
    }
  }

  // Color Keys Shortcuts
  function handleColorKey(color) {
    if (color === 'red') {
      if (state.currentView === 'player') toggleCurrentPlayingFavorite();
      else toggleInspectorFavorite();
    } else if (color === 'green') {
      switchToView(state.currentView === 'epg' ? 'catalog' : 'epg');
    } else if (color === 'yellow') {
      state.isOnlyFavorites = !state.isOnlyFavorites;
      state.catalogPage = 1;
      updateActiveFilterBadge();
      if (state.currentView !== 'catalog') switchToView('catalog');
      loadCatalogChannels();
    } else if (color === 'blue') {
      switchToView('server');
    }
  }

  // Key Event Navigation
  function isBackKey(e) {
    const code = e.keyCode || e.which;
    const key = e.key;
    return (
      code === KEYS.BACK_WEBOS ||
      code === KEYS.BACK_ESC ||
      code === KEYS.BACK_BS ||
      code === KEYS.BACK_SMART ||
      key === 'Back' ||
      key === 'GoBack' ||
      key === 'Escape'
    );
  }

  function setupEventListeners() {
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', (e) => {
      if (isBackKey(e)) {
        if (document.activeElement && document.activeElement.tagName === 'INPUT' && (e.keyCode === KEYS.BACK_BS)) {
          return; // Allow backspace inside input fields
        }
        e.preventDefault();
        e.stopPropagation();
        handleBackNavigation();
      }
    }, true);

    window.addEventListener('popstate', () => {
      handleBackNavigation();
    });

    // Magic Remote pointer / mouse hover
    document.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.channel-matrix-card');
      if (card) {
        const idx = parseInt(card.dataset.index, 10);
        if (!isNaN(idx) && (idx !== state.channelIndex || state.focusSection !== 'channels')) {
          state.focusSection = 'channels';
          state.channelIndex = idx;
          updateChannelFocus();
        }
      }
    });

    document.addEventListener('click', (e) => {
      const card = e.target.closest('.channel-matrix-card');
      if (card) {
        const idx = parseInt(card.dataset.index, 10);
        if (!isNaN(idx)) {
          state.channelIndex = idx;
          watchSelectedFullscreen();
        }
      }
      const catPill = e.target.closest('.category-pill');
      if (catPill) {
        const pills = Array.from(dom.categoryRail.querySelectorAll('.category-pill'));
        const idx = pills.indexOf(catPill);
        if (idx !== -1) selectCategory(idx);
      }
    });
  }

  function handleBackNavigation() {
    if (dom.errorOverlay.style.display === 'flex') {
      hideError();
      return;
    }

    if (state.currentView === 'player') {
      stopPlayerAndReturn();
      return;
    }

    if (state.currentView === 'catalog' || state.currentView === 'epg' || state.currentView === 'server') {
      switchToView('hub');
      return;
    }
  }

  // Multi-page Numeric Channel Jump (Fixed BUG-12)
  async function jumpToChannelNumber(targetNum) {
    if (targetNum <= 0) return;
    const targetPage = Math.ceil(targetNum / state.catalogLimit);
    const indexInPage = (targetNum - 1) % state.catalogLimit;

    if (targetPage > state.catalogTotalPages) return;

    if (targetPage !== state.catalogPage) {
      state.catalogPage = targetPage;
      await loadCatalogChannels();
    }
    if (indexInPage < state.channels.length) {
      state.focusSection = 'channels';
      state.channelIndex = indexInPage;
      updateChannelFocus();
    }
  }

  function handleKeyDown(e) {
    const key = e.keyCode || e.which;

    // Allow typing inside input elements unless navigating away with UP/DOWN/ESC
    const isInputFocused = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (isInputFocused) {
      if (key === KEYS.BACK_WEBOS || key === KEYS.BACK_ESC) {
        document.activeElement.blur();
        e.preventDefault();
        return;
      }
      if (key !== KEYS.UP && key !== KEYS.DOWN && key !== KEYS.ENTER) {
        return;
      }
    }

    // Back key
    if (isBackKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      handleBackNavigation();
      return;
    }

    // Color keys
    if (key === KEYS.COLOR_RED) { handleColorKey('red'); return; }
    if (key === KEYS.COLOR_GREEN) { handleColorKey('green'); return; }
    if (key === KEYS.COLOR_YELLOW) { handleColorKey('yellow'); return; }
    if (key === KEYS.COLOR_BLUE) { handleColorKey('blue'); return; }

    // Channel Numeric Jump (0-9)
    if ((key >= 48 && key <= 57) || (key >= 96 && key <= 105)) {
      const digit = key >= 96 ? String(key - 96) : String(key - 48);
      state.numericBuffer += digit;
      if (dom.numericDisplay) dom.numericDisplay.textContent = state.numericBuffer;

      if (state.numericTimeout) clearTimeout(state.numericTimeout);
      state.numericTimeout = setTimeout(() => {
        const targetNum = parseInt(state.numericBuffer, 10);
        state.numericBuffer = '';
        if (dom.numericDisplay) dom.numericDisplay.textContent = '_ _ _';

        if (state.currentView === 'hub') {
          const modes = ['live', 'movies', 'series', 'favorites'];
          if (targetNum >= 1 && targetNum <= 4) {
            selectHubMode(modes[targetNum - 1]);
          }
        } else if (state.currentView === 'catalog') {
          jumpToChannelNumber(targetNum);
        } else if (state.currentView === 'player') {
          jumpToChannelNumber(targetNum).then(() => {
            if (state.channels[state.channelIndex]) {
              playChannelByObject(state.channels[state.channelIndex], state.channelIndex);
            }
          });
        }
      }, 1400);
      return;
    }

    // Global Section: Top Navigation Bar ('tabs')
    if (state.focusSection === 'tabs') {
      const viewOrder = ['hub', 'catalog', 'player', 'epg', 'server'];
      if (key === KEYS.LEFT) {
        state.navTabIndex = Math.max(0, state.navTabIndex - 1);
        updateTabsFocus();
      } else if (key === KEYS.RIGHT) {
        state.navTabIndex = Math.min(viewOrder.length - 1, state.navTabIndex + 1);
        updateTabsFocus();
      } else if (key === KEYS.DOWN) {
        if (state.currentView === 'hub') {
          state.focusSection = 'hub';
          updateHubFocus();
        } else if (state.currentView === 'catalog') {
          state.focusSection = 'categories';
          updateCategorySelection();
        } else if (state.currentView === 'epg') {
          state.focusSection = 'epg';
          updateEpgFocus();
        } else if (state.currentView === 'server') {
          state.focusSection = 'server';
          updateServerViewFocus();
        }
      } else if (key === KEYS.ENTER) {
        switchToView(viewOrder[state.navTabIndex]);
      }
      return;
    }

    // View: HUB (4 CARDS NAVIGATION)
    if (state.currentView === 'hub') {
      const modes = ['live', 'movies', 'series', 'favorites'];
      if (key === KEYS.LEFT) {
        state.hubIndex = Math.max(0, state.hubIndex - 1);
        updateHubFocus();
      } else if (key === KEYS.RIGHT) {
        state.hubIndex = Math.min(3, state.hubIndex + 1);
        updateHubFocus();
      } else if (key === KEYS.UP) {
        state.focusSection = 'tabs';
        updateTabsFocus();
      } else if (key === KEYS.ENTER) {
        selectHubMode(modes[state.hubIndex]);
      }
      return;
    }

    // View: PLAYER (Live TV + VOD Seek Support)
    if (state.currentView === 'player') {
      const isVod = state.selectedChannel && (state.selectedChannel.contentType === 'movies' || state.selectedChannel.contentType === 'series');
      if (key === KEYS.LEFT || key === KEYS.REWIND) {
        if (isVod) {
          seekVod(-15);
        } else {
          stopPlayerAndReturn();
        }
      } else if (key === KEYS.RIGHT || key === KEYS.FAST_FORWARD) {
        if (isVod) {
          seekVod(30);
        } else {
          showPlayerHud();
        }
      } else if (key === KEYS.ENTER) {
        if (dom.playerHudOverlay.classList.contains('visible')) {
          togglePlayPause();
        } else {
          showPlayerHud();
        }
      } else if (key === KEYS.UP || key === KEYS.CH_UP) {
        playNextChannel();
      } else if (key === KEYS.DOWN || key === KEYS.CH_DOWN) {
        playPrevChannel();
      } else if (key === KEYS.PLAY || key === KEYS.PAUSE) {
        togglePlayPause();
      } else if (key === KEYS.STOP) {
        stopPlayerAndReturn();
      }
      return;
    }

    // View: EPG TIMELINE
    if (state.currentView === 'epg') {
      const totalEpg = state.epgChannels.length;
      if (key === KEYS.UP) {
        if (state.epgFocusIndex > 0) {
          state.epgFocusIndex--;
          updateEpgFocus();
        } else {
          state.focusSection = 'tabs';
          updateTabsFocus();
        }
      } else if (key === KEYS.DOWN) {
        if (state.epgFocusIndex < totalEpg - 1) {
          state.epgFocusIndex++;
          updateEpgFocus();
        }
      } else if (key === KEYS.ENTER) {
        playEpgChannel(state.epgFocusIndex);
      }
      return;
    }

    // View: SERVER & PAIRING
    if (state.currentView === 'server') {
      const els = dom.viewServer.querySelectorAll('.focusable');
      if (key === KEYS.UP) {
        if (state.serverFocusIndex > 0) {
          if (document.activeElement) document.activeElement.blur();
          state.serverFocusIndex--;
          updateServerViewFocus();
        } else {
          if (document.activeElement) document.activeElement.blur();
          state.focusSection = 'tabs';
          updateTabsFocus();
        }
      } else if (key === KEYS.DOWN) {
        if (state.serverFocusIndex < els.length - 1) {
          if (document.activeElement) document.activeElement.blur();
          state.serverFocusIndex++;
          updateServerViewFocus();
        }
      } else if (key === KEYS.ENTER) {
        if (state.serverFocusIndex === els.length - 1) {
          confirmSetupPairing();
        }
      }
      return;
    }

    // View: CATALOG (Multi-Zone Spatial Navigation: categories, channels, inspector, pagination)
    if (state.currentView === 'catalog') {
      const cols = 2;
      const total = state.channels.length;
      const totalPills = dom.categoryRail.querySelectorAll('.category-pill').length;

      // Zone 1: Category Rail
      if (state.focusSection === 'categories') {
        if (key === KEYS.LEFT) {
          if (state.categoryIndex > 0) {
            selectCategory(state.categoryIndex - 1);
          }
        } else if (key === KEYS.RIGHT) {
          if (state.categoryIndex < totalPills - 1) {
            selectCategory(state.categoryIndex + 1);
          }
        } else if (key === KEYS.UP) {
          state.focusSection = 'tabs';
          updateCategorySelection();
          updateTabsFocus();
        } else if (key === KEYS.DOWN || key === KEYS.ENTER) {
          state.focusSection = 'channels';
          updateCategorySelection();
          updateChannelFocus();
        }
        return;
      }

      // Zone 2: Right Inspector Panel (Watch Fullscreen / Favorite)
      if (state.focusSection === 'inspector') {
        if (key === KEYS.LEFT) {
          state.focusSection = 'channels';
          updateChannelFocus();
        } else if (key === KEYS.UP) {
          state.inspectorFocusIndex = 1; // Favorite star button
          updateInspectorFocus();
        } else if (key === KEYS.DOWN) {
          state.inspectorFocusIndex = 0; // Watch Fullscreen button
          updateInspectorFocus();
        } else if (key === KEYS.ENTER) {
          if (state.inspectorFocusIndex === 0) watchSelectedFullscreen();
          else toggleInspectorFavorite();
        }
        return;
      }

      // Zone 3: Pagination Buttons (Prev / Next)
      if (state.focusSection === 'pagination') {
        if (key === KEYS.LEFT) {
          state.paginationFocusIndex = 0;
          updatePaginationFocus();
        } else if (key === KEYS.RIGHT) {
          state.paginationFocusIndex = 1;
          updatePaginationFocus();
        } else if (key === KEYS.UP) {
          state.focusSection = 'channels';
          updateChannelFocus();
        } else if (key === KEYS.ENTER) {
          changeCatalogPage(state.paginationFocusIndex === 0 ? -1 : 1);
          state.focusSection = 'channels';
        }
        return;
      }

      // Zone 4: Channels Matrix (2 Columns)
      if (key === KEYS.LEFT) {
        if (state.channelIndex % cols === 1) {
          state.channelIndex = Math.max(0, state.channelIndex - 1);
          updateChannelFocus();
        }
      } else if (key === KEYS.RIGHT) {
        if (state.channelIndex % cols === 0 && state.channelIndex + 1 < total) {
          state.channelIndex += 1;
          updateChannelFocus();
        } else {
          // Move focus smoothly to the Right Inspector Panel ("Assistir em Tela Cheia")
          state.focusSection = 'inspector';
          state.inspectorFocusIndex = 0;
          updateInspectorFocus();
        }
      } else if (key === KEYS.UP) {
        if (state.channelIndex - cols >= 0) {
          state.channelIndex -= cols;
          updateChannelFocus();
        } else {
          // Move focus up to Category Rail without changing category accidentally
          state.focusSection = 'categories';
          clearAllSectionFocusRings();
          updateCategorySelection();
        }
      } else if (key === KEYS.DOWN) {
        if (state.channelIndex + cols < total) {
          state.channelIndex += cols;
          updateChannelFocus();
        } else if (state.catalogTotalPages > 1) {
          state.focusSection = 'pagination';
          state.paginationFocusIndex = state.catalogPage < state.catalogTotalPages ? 1 : 0;
          updatePaginationFocus();
        }
      } else if (key === KEYS.CH_UP) {
        changeCatalogPage(1);
      } else if (key === KEYS.CH_DOWN) {
        changeCatalogPage(-1);
      } else if (key === KEYS.ENTER) {
        watchSelectedFullscreen();
      }
      return;
    }
  }

  // Global exports for inline onclick attributes
  window.switchToView = switchToView;
  window.selectHubMode = selectHubMode;
  window.changeCatalogPage = changeCatalogPage;
  window.onCatalogSearchInput = onCatalogSearchInput;
  window.clearCatalogSearch = clearCatalogSearch;
  window.watchSelectedFullscreen = watchSelectedFullscreen;
  window.stopPlayerAndReturn = stopPlayerAndReturn;
  window.toggleInspectorFavorite = toggleInspectorFavorite;
  window.toggleCurrentPlayingFavorite = toggleCurrentPlayingFavorite;
  window.playNextChannel = playNextChannel;
  window.playPrevChannel = playPrevChannel;
  window.togglePlayPause = togglePlayPause;
  window.onVodScrubberClick = onVodScrubberClick;
  window.playEpgChannel = playEpgChannel;
  window.hideError = hideError;
  window.retryCurrentChannel = retryCurrentChannel;
  window.confirmSetupPairing = confirmSetupPairing;
  window.handleColorKey = handleColorKey;

  window.addEventListener('DOMContentLoaded', init);
})();
