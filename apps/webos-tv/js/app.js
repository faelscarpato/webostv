/**
 * StreamOS Live - LG webOS IPTV Player Core Engine
 * Cinematic Lumina 10-Foot UI Implementation with Hls.js MSE decoding
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
    // LG Remote 4 Color Keys
    COLOR_RED: 403,
    COLOR_GREEN: 404,
    COLOR_YELLOW: 405,
    COLOR_BLUE: 406,
  };

  // State
  const state = {
    serverUrl: localStorage.getItem('iptv_server_url') || 'http://192.168.18.7:3001',
    deviceToken: localStorage.getItem('iptv_device_token') || '',
    deviceId: getOrCreateDeviceId(),
    currentView: 'catalog', // 'catalog' | 'player' | 'epg' | 'server'
    focusSection: 'channels', // 'tabs' | 'categories' | 'channels' | 'inspector' | 'player' | 'epg'
    categoryIndex: 0,
    channelIndex: 0,
    catalogPage: 1,
    catalogTotalPages: 1,
    catalogLimit: 20,
    groups: [],
    channels: [],
    selectedChannel: null,
    currentPlayingIndex: -1,
    isOnlyFavorites: false,
    hudTimeout: null,
    numericBuffer: '',
    numericTimeout: null,
  };

  let hlsInstance = null;
  let streamTimeout = null;

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
    channelCounter: document.getElementById('channel-counter'),
    channelsMatrix: document.getElementById('channels-matrix'),
    catalogPageLabel: document.getElementById('catalog-page-label'),
    catalogPrevBtn: document.getElementById('catalog-prev-btn'),
    catalogNextBtn: document.getElementById('catalog-next-btn'),
    numericDisplay: document.getElementById('numeric-input-display'),
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
    // Inspector & PiP
    inspectorName: document.getElementById('inspector-name'),
    inspectorGroup: document.getElementById('inspector-group'),
    inspectorFavIcon: document.getElementById('inspector-fav-icon'),
    inspectorEpgTitle: document.getElementById('inspector-epg-title'),
    inspectorEpgTime: document.getElementById('inspector-epg-time'),
    inspectorEpgDesc: document.getElementById('inspector-epg-desc'),
    pipFallbackText: document.getElementById('pip-fallback-text'),
    pipChNum: document.getElementById('pip-ch-num'),
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

  // Initialization
  async function init() {
    setupEventListeners();
    setupVideoPlayer();

    if (dom.headerServerIp) {
      dom.headerServerIp.textContent = state.serverUrl.replace(/^https?:\/\//, '');
    }

    if (!state.deviceToken) {
      switchToView('server');
    } else {
      await loadInitialData();
    }
  }

  // View Switcher
  function switchToView(viewName) {
    state.currentView = viewName;

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
    dom.viewCatalog.classList.add('hidden');
    dom.viewPlayer.classList.add('hidden');
    dom.viewEpg.classList.add('hidden');
    dom.viewServer.classList.add('hidden');

    if (viewName === 'catalog') {
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
    }
  }

  // Load Initial Server Data
  async function loadInitialData() {
    showLoading(true, 'Sincronizando com o Servidor Local...');
    const t0 = performance.now();
    try {
      const headers = { 'Authorization': `Bearer ${state.deviceToken}` };

      // Status
      const statusRes = await fetch(`${state.serverUrl}/api/status`, { headers });
      const pingMs = Math.round(performance.now() - t0);
      if (dom.headerPing) dom.headerPing.textContent = `${pingMs}ms`;

      // Groups
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

    // Item 1: Favoritos
    const favBtn = document.createElement('button');
    favBtn.className = 'category-pill flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high/90 text-on-surface border border-outline-variant/40 text-sm font-label-lg transition-all focusable shrink-0';
    favBtn.dataset.type = 'fav';
    favBtn.innerHTML = `
      <span class="material-symbols-outlined text-[#ffcc00] text-[20px]" style="font-variation-settings: 'FILL' 1;">star</span>
      <span>Favoritos</span>
    `;
    dom.categoryRail.appendChild(favBtn);

    // Item 2: Todos
    const allBtn = document.createElement('button');
    allBtn.className = 'category-pill flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high/70 text-on-surface border border-outline-variant/30 text-sm font-label-lg transition-all focusable shrink-0';
    allBtn.dataset.type = 'all';
    allBtn.innerHTML = `
      <span class="material-symbols-outlined text-primary text-[20px]">live_tv</span>
      <span>Todos</span>
    `;
    dom.categoryRail.appendChild(allBtn);

    // Dynamic Groups
    state.groups.filter(g => !g.isHidden).forEach(g => {
      const gBtn = document.createElement('button');
      gBtn.className = 'category-pill flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-high/70 text-on-surface border border-outline-variant/30 text-sm font-label-lg transition-all focusable shrink-0';
      gBtn.dataset.type = 'group';
      gBtn.dataset.name = g.name;
      gBtn.innerHTML = `
        <span>${g.name}</span>
        <span class="text-xs font-label-tech text-on-surface-variant bg-surface-container-lowest px-2 py-0.5 rounded-full">${g.count}</span>
      `;
      dom.categoryRail.appendChild(gBtn);
    });

    updateCategorySelection();
  }

  function updateCategorySelection() {
    const pills = dom.categoryRail.querySelectorAll('.category-pill');
    pills.forEach((pill, idx) => {
      if (idx === state.categoryIndex) {
        pill.classList.add('bg-primary-container', 'text-on-primary-container', 'border-2', 'border-primary-fixed', 'font-bold', 'scale-105', 'shadow-[0_0_16px_rgba(0,210,255,0.4)]');
        pill.classList.remove('bg-surface-container-high/70', 'bg-surface-container-high/90', 'text-on-surface', 'border-outline-variant/30', 'border-outline-variant/40');
        pill.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      } else {
        pill.classList.remove('bg-primary-container', 'text-on-primary-container', 'border-2', 'border-primary-fixed', 'font-bold', 'scale-105', 'shadow-[0_0_16px_rgba(0,210,255,0.4)]');
        pill.classList.add('bg-surface-container-high/70', 'text-on-surface', 'border-outline-variant/30');
      }
    });
  }

  async function selectCategory(idx) {
    state.categoryIndex = idx;
    updateCategorySelection();
    state.catalogPage = 1;
    await loadCatalogChannels();
  }

  // Load Channels with Pagination
  async function loadCatalogChannels() {
    const pills = dom.categoryRail.querySelectorAll('.category-pill');
    const selectedPill = pills[state.categoryIndex];
    if (!selectedPill) return;

    const type = selectedPill.dataset.type;
    const headers = { 'Authorization': `Bearer ${state.deviceToken}` };
    const params = new URLSearchParams({
      page: state.catalogPage,
      limit: state.catalogLimit,
    });

    if (type === 'fav' || state.isOnlyFavorites) {
      params.append('favorites', 'true');
      dom.currentCategoryTitle.textContent = 'Canais Favoritos';
    } else if (type === 'all') {
      dom.currentCategoryTitle.textContent = 'Todos os Canais';
    } else if (type === 'group') {
      const gName = selectedPill.dataset.name;
      params.append('group', gName);
      dom.currentCategoryTitle.textContent = gName;
    }

    try {
      const res = await fetch(`${state.serverUrl}/api/channels?${params.toString()}`, { headers });
      const data = await res.json();

      state.channels = data.channels || [];
      state.catalogTotalPages = data.totalPages || 1;
      dom.channelCounter.innerHTML = `Exibindo <span class="text-primary font-bold">${data.total || state.channels.length}</span> canais`;
      dom.catalogPageLabel.textContent = `Página ${state.catalogPage} de ${state.catalogTotalPages}`;

      dom.catalogPrevBtn.disabled = state.catalogPage <= 1;
      dom.catalogNextBtn.disabled = state.catalogPage >= state.catalogTotalPages;

      state.channelIndex = 0;
      renderChannelsMatrix();
    } catch (err) {
      console.error('Falha ao buscar canais:', err);
    }
  }

  function changeCatalogPage(delta) {
    const newPage = state.catalogPage + delta;
    if (newPage >= 1 && newPage <= state.catalogTotalPages) {
      state.catalogPage = newPage;
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
          <p>Nenhum canal encontrado nesta categoria.</p>
        </div>
      `;
      updateInspectorDetails(null);
      return;
    }

    state.channels.forEach((ch, idx) => {
      const card = document.createElement('div');
      const isFocused = idx === state.channelIndex;
      card.className = `channel-matrix-card relative rounded-xl p-3 flex flex-col justify-between transition-all duration-150 cursor-pointer border ${isFocused ? 'focus-tv-active bg-surface-container border-2 border-primary-container neon-pulse' : 'bg-surface-container-low/90 border-outline-variant/30 hover:border-primary/50'}`;
      card.dataset.index = idx;

      const chNumber = String((state.catalogPage - 1) * state.catalogLimit + idx + 1).padStart(3, '0');
      const starIcon = ch.isFavorite
        ? `<span class="material-symbols-outlined text-[#ffcc00] text-[20px]" style="font-variation-settings: 'FILL' 1;">star</span>`
        : '';

      const logoImg = ch.logoUrl
        ? `<img src="${ch.logoUrl}" loading="lazy" class="w-10 h-10 object-contain rounded-lg bg-surface-container-highest p-0.5 shrink-0" onerror="this.outerHTML='<div class=\\'w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-xs font-bold font-label-tech text-primary shrink-0\\'>${chNumber}</div>'"/>`
        : `<div class="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-xs font-bold font-label-tech text-primary shrink-0">${chNumber}</div>`;

      card.innerHTML = `
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2 min-w-0">
            ${logoImg}
            <div class="min-w-0">
              <h3 class="text-sm font-headline-sm font-bold text-white truncate max-w-[180px]">${ch.name}</h3>
              <span class="text-[11px] font-label-tech text-on-surface-variant truncate block">${ch.groupTitle}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${starIcon}
            <span class="text-[10px] font-label-tech bg-surface-container-highest px-1.5 py-0.5 rounded border border-outline-variant/40 text-on-surface">HLS</span>
          </div>
        </div>
        <div class="mt-2.5 pt-2 border-t border-outline-variant/20">
          <div class="text-[11px] text-on-surface-variant font-label-tech truncate flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-secondary-container shrink-0"></span>
            <span class="truncate">${ch.tvgName || 'Transmissão Ao Vivo'}</span>
          </div>
          <div class="w-full bg-surface-container-highest h-1 rounded-full mt-1.5 overflow-hidden">
            <div class="bg-primary h-full rounded-full" style="width: 65%;"></div>
          </div>
        </div>
      `;
      dom.channelsMatrix.appendChild(card);
    });

    updateChannelFocus();
    updateInspectorDetails(state.channels[state.channelIndex] || null);
  }

  function updateChannelFocus() {
    const cards = dom.channelsMatrix.querySelectorAll('.channel-matrix-card');
    cards.forEach((card, idx) => {
      if (idx === state.channelIndex) {
        card.classList.add('focus-tv-active', 'bg-surface-container', 'border-2', 'border-primary-container', 'neon-pulse');
        card.classList.remove('bg-surface-container-low/90', 'border-outline-variant/30');
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        updateInspectorDetails(state.channels[idx] || null);
      } else {
        card.classList.remove('focus-tv-active', 'bg-surface-container', 'border-2', 'border-primary-container', 'neon-pulse');
        card.classList.add('bg-surface-container-low/90', 'border-outline-variant/30');
      }
    });
  }

  // Update Right Inspector Panel
  function updateInspectorDetails(channel) {
    state.selectedChannel = channel;
    if (!channel) {
      dom.inspectorName.textContent = 'Nenhum canal';
      dom.inspectorGroup.textContent = '';
      dom.pipFallbackText.textContent = 'Selecione um canal';
      return;
    }

    const num = String((state.catalogPage - 1) * state.catalogLimit + state.channelIndex + 1).padStart(3, '0');
    dom.inspectorName.textContent = `${num} ${channel.name}`;
    dom.inspectorGroup.textContent = `${channel.groupTitle} · HLS Stream Local`;
    dom.pipChNum.textContent = `CH ${num}`;
    dom.pipFallbackText.textContent = `Pressione [OK] para assistir ${channel.name}`;

    if (channel.isFavorite) {
      dom.inspectorFavIcon.textContent = 'star';
      dom.inspectorFavIcon.classList.add('text-[#ffcc00]');
    } else {
      dom.inspectorFavIcon.textContent = 'star_border';
      dom.inspectorFavIcon.classList.remove('text-[#ffcc00]');
    }

    dom.inspectorEpgTitle.textContent = channel.tvgName || 'Programação Ao Vivo';
    dom.inspectorEpgDesc.textContent = `Transmissão HLS ao vivo do canal ${channel.name}. Sinal local processado pelo servidor doméstico.`;
  }

  // Watch Fullscreen
  function watchSelectedFullscreen() {
    if (!state.selectedChannel) return;
    playChannelByObject(state.selectedChannel, state.channelIndex);
  }

  // Video Player Logic with Hls.js
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
    v.addEventListener('timeupdate', () => {
      if (v.currentTime > 0) showLoading(false);
    });

    v.addEventListener('waiting', () => {
      if (v.currentTime === 0) showLoading(true, 'Buffering stream...');
    });

    v.addEventListener('error', (e) => {
      if (streamTimeout) clearTimeout(streamTimeout);
      showLoading(false);
      const code = v.error ? v.error.code : 'Desconhecido';
      console.warn('Native video error:', code);
      if (!hlsInstance) {
        showError(`Não foi possível reproduzir este canal.\n(Código: ${code})\nVerifique se o stream está online.`);
      }
    });
  }

  function playChannelByObject(channel, index) {
    if (!channel) return;

    if (streamTimeout) clearTimeout(streamTimeout);
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    state.currentPlayingIndex = index;
    state.selectedChannel = channel;

    // Update Player HUD Info
    const num = String((state.catalogPage - 1) * state.catalogLimit + index + 1).padStart(3, '0');
    dom.playerHudNum.textContent = `CH ${num}`;
    dom.playerHudName.textContent = channel.name;
    dom.playerHudGroup.textContent = channel.groupTitle;
    dom.playerHudEpgTitle.textContent = channel.tvgName || 'Transmissão Ao Vivo';
    dom.playerHudEpgTime.textContent = 'Ao Vivo';

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

    // 15 seconds watchdog
    streamTimeout = setTimeout(() => {
      showLoading(false);
      showError(`O canal '${channel.name}' demorou mais de 15 segundos para responder.\nVerifique se o stream está online.`);
    }, 15000);

    const streamUrl = channel.url.trim();

    // Reset media element
    dom.videoPlayer.pause();
    dom.videoPlayer.removeAttribute('src');
    dom.videoPlayer.load();

    if (window.Hls && Hls.isSupported() && (streamUrl.includes('.m3u8') || streamUrl.includes('live') || !streamUrl.includes('.mp4'))) {
      try {
        hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          manifestLoadingTimeOut: 10000,
          levelLoadingTimeOut: 10000,
          fragLoadingTimeOut: 15000,
        });

        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(dom.videoPlayer);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          dom.videoPlayer.play().catch(err => {
            console.warn('Autoplay prevented:', err);
            dom.videoPlayer.muted = false;
            dom.videoPlayer.play().catch(e => console.warn('Play retry failed:', e));
          });
        });

        hlsInstance.on(Hls.Events.ERROR, (event, data) => {
          console.warn('HLS Event Error:', data.type, data.details, data.fatal);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hlsInstance.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hlsInstance.recoverMediaError();
                break;
              default:
                if (streamTimeout) clearTimeout(streamTimeout);
                showLoading(false);
                showError(`Falha na transmissão: ${data.details || 'Stream indisponível'}`);
                break;
            }
          }
        });
      } catch (hlsErr) {
        console.warn('HLS.js fallback:', hlsErr);
        dom.videoPlayer.src = streamUrl;
        dom.videoPlayer.play().catch(e => console.warn(e));
      }
    } else {
      dom.videoPlayer.src = streamUrl;
      dom.videoPlayer.play().catch(err => console.warn(err));
    }
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
  }

  function showPlayerHud() {
    dom.playerHudOverlay.classList.add('visible');
    if (state.hudTimeout) clearTimeout(state.hudTimeout);
    state.hudTimeout = setTimeout(() => {
      dom.playerHudOverlay.classList.remove('visible');
    }, 4500);
  }

  function stopPlayerAndReturn() {
    if (streamTimeout) {
      clearTimeout(streamTimeout);
      streamTimeout = null;
    }
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    dom.videoPlayer.pause();
    dom.videoPlayer.removeAttribute('src');
    dom.videoPlayer.load();

    showLoading(false);
    switchToView('catalog');
  }

  // Favorite Toggles
  async function toggleInspectorFavorite() {
    if (!state.selectedChannel) return;
    const ch = state.selectedChannel;
    const newFav = !ch.isFavorite;

    await fetch(`${state.serverUrl}/api/channels/${ch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: newFav }),
    });

    ch.isFavorite = newFav;
    renderChannelsMatrix();
  }

  async function toggleCurrentPlayingFavorite() {
    if (!state.selectedChannel) return;
    await toggleInspectorFavorite();
    if (dom.playerFavIcon) {
      dom.playerFavIcon.textContent = state.selectedChannel.isFavorite ? 'star' : 'star_border';
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

  // Guia EPG Timeline View
  async function loadEpgTimeline() {
    dom.epgTimelineContainer.innerHTML = '<div class="text-center text-on-surface-variant font-label-tech py-12">Carregando guia de programação...</div>';
    try {
      const headers = { 'Authorization': `Bearer ${state.deviceToken}` };
      const res = await fetch(`${state.serverUrl}/api/channels?limit=15`, { headers });
      const data = await res.json();
      const chList = data.channels || [];

      if (chList.length === 0) {
        dom.epgTimelineContainer.innerHTML = '<div class="text-center text-on-surface-variant font-label-tech py-12">Nenhum canal disponível para o guia.</div>';
        return;
      }

      dom.epgTimelineContainer.innerHTML = `
        <div class="flex flex-col gap-3">
          ${chList.map((c, i) => `
            <div class="flex items-center gap-4 bg-surface-container-low p-3 rounded-xl border border-outline-variant/30 focusable hover:border-primary cursor-pointer" onclick="playChannelByObject(state.channels[${i}], ${i})">
              <div class="w-48 shrink-0 flex items-center gap-3">
                <span class="text-primary font-bold font-label-tech">${String(i + 1).padStart(3, '0')}</span>
                <span class="font-bold text-white truncate">${c.name}</span>
              </div>
              <div class="flex-1 bg-surface-container px-4 py-2 rounded-lg border border-outline-variant/20 flex justify-between items-center">
                <div>
                  <div class="text-sm font-semibold text-[#ffcc00]">${c.tvgName || 'Programação Ao Vivo'}</div>
                  <div class="text-xs text-on-surface-variant font-label-tech">18:00 - 20:00 · Transmissão Principal</div>
                </div>
                <span class="text-xs font-label-tech bg-primary-container text-on-primary-container px-2 py-0.5 rounded font-bold">AO VIVO</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      dom.epgTimelineContainer.innerHTML = `<div class="text-center text-error font-label-tech py-12">Falha ao carregar EPG: ${err.message}</div>`;
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
        if (!isNaN(idx) && idx !== state.channelIndex) {
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

    if (state.currentView === 'epg' || state.currentView === 'server') {
      switchToView('catalog');
      return;
    }
  }

  function handleKeyDown(e) {
    const key = e.keyCode || e.which;

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

        if (targetNum > 0 && targetNum <= state.channels.length) {
          state.channelIndex = targetNum - 1;
          updateChannelFocus();
        }
      }, 1500);
      return;
    }

    // View: PLAYER
    if (state.currentView === 'player') {
      if (key === KEYS.LEFT) {
        stopPlayerAndReturn();
      } else if (key === KEYS.ENTER) {
        showPlayerHud();
      } else if (key === KEYS.UP || key === KEYS.CH_UP) {
        playNextChannel();
      } else if (key === KEYS.DOWN || key === KEYS.CH_DOWN) {
        playPrevChannel();
      } else if (key === KEYS.PLAY || key === KEYS.PAUSE) {
        togglePlayPause();
      }
      return;
    }

    // View: CATALOG
    if (state.currentView === 'catalog') {
      const cols = 2;
      const total = state.channels.length;

      if (key === KEYS.LEFT) {
        if (state.channelIndex % cols === 0) {
          // Move category left
          if (state.categoryIndex > 0) {
            selectCategory(state.categoryIndex - 1);
          }
        } else {
          state.channelIndex = Math.max(0, state.channelIndex - 1);
          updateChannelFocus();
        }
      } else if (key === KEYS.RIGHT) {
        if (state.channelIndex % cols === 1 || state.channelIndex === total - 1) {
          // Move category right
          const totalPills = dom.categoryRail.querySelectorAll('.category-pill').length;
          if (state.categoryIndex < totalPills - 1) {
            selectCategory(state.categoryIndex + 1);
          }
        } else {
          state.channelIndex = Math.min(total - 1, state.channelIndex + 1);
          updateChannelFocus();
        }
      } else if (key === KEYS.UP) {
        if (state.channelIndex - cols >= 0) {
          state.channelIndex -= cols;
          updateChannelFocus();
        } else {
          // Jump to category rail
          const totalPills = dom.categoryRail.querySelectorAll('.category-pill').length;
          state.categoryIndex = Math.max(0, state.categoryIndex - 1);
          updateCategorySelection();
        }
      } else if (key === KEYS.DOWN) {
        if (state.channelIndex + cols < total) {
          state.channelIndex += cols;
          updateChannelFocus();
        } else if (state.catalogPage < state.catalogTotalPages) {
          changeCatalogPage(1);
        }
      } else if (key === KEYS.ENTER) {
        watchSelectedFullscreen();
      }
      return;
    }
  }

  // Global exports for inline onclick attributes
  window.switchToView = switchToView;
  window.changeCatalogPage = changeCatalogPage;
  window.watchSelectedFullscreen = watchSelectedFullscreen;
  window.stopPlayerAndReturn = stopPlayerAndReturn;
  window.toggleInspectorFavorite = toggleInspectorFavorite;
  window.toggleCurrentPlayingFavorite = toggleCurrentPlayingFavorite;
  window.playNextChannel = playNextChannel;
  window.playPrevChannel = playPrevChannel;
  window.togglePlayPause = togglePlayPause;
  window.hideError = hideError;
  window.retryCurrentChannel = retryCurrentChannel;
  window.confirmSetupPairing = confirmSetupPairing;
  window.handleColorKey = handleColorKey;

  window.addEventListener('DOMContentLoaded', init);
})();
