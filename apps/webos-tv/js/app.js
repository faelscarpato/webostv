/**
 * IPTV Local Player - webOS Client
 * 10-foot UI with Spatial Navigation and Native Video Player
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
    BACK: 461, // webOS Back button
    BACK_BROWSER: 27, // ESC on keyboard for testing
    PLAY: 415,
    PAUSE: 19,
    STOP: 413,
    CH_UP: 33,
    CH_DOWN: 34,
  };

  // State
  const state = {
    serverUrl: localStorage.getItem('iptv_server_url') || 'http://192.168.18.7:3001',
    deviceToken: localStorage.getItem('iptv_device_token') || '',
    deviceId: getOrCreateDeviceId(),
    currentView: 'main', // 'main' | 'player' | 'pairing' | 'error'
    focusArea: 'sidebar', // 'sidebar' | 'channels' | 'player' | 'pairing' | 'error'
    sidebarIndex: 0,
    channelIndex: 0,
    groups: [],
    allChannels: [],
    filteredChannels: [],
    currentPlayingIndex: -1,
    osdTimeout: null,
  };

  function getOrCreateDeviceId() {
    let id = localStorage.getItem('iptv_device_id');
    if (!id) {
      id = 'tv_lg_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('iptv_device_id', id);
    }
    return id;
  }

  // DOM Elements
  const dom = {
    mainView: document.getElementById('main-view'),
    playerContainer: document.getElementById('player-container'),
    videoPlayer: document.getElementById('video-player'),
    playerOsd: document.getElementById('player-osd'),
    loadingOverlay: document.getElementById('loading-overlay'),
    errorOverlay: document.getElementById('error-overlay'),
    pairingView: document.getElementById('pairing-view'),
    sidebarMenu: document.getElementById('sidebar-menu'),
    channelGrid: document.getElementById('channel-grid'),
    contentTitle: document.getElementById('content-title'),
    contentSubtitle: document.getElementById('content-subtitle'),
    osdChannelNum: document.getElementById('osd-channel-num'),
    osdChannelName: document.getElementById('osd-channel-name'),
    osdGroupName: document.getElementById('osd-group-name'),
    osdEpgTitle: document.getElementById('osd-epg-title'),
    osdClock: document.getElementById('osd-clock'),
    errorMessage: document.getElementById('error-message'),
    pairingServerInput: document.getElementById('pairing-server-input'),
    pairingPinInput: document.getElementById('pairing-pin-input'),
    pairingError: document.getElementById('pairing-error'),
  };

  // Clock
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${mins}`;
    if (dom.osdClock) dom.osdClock.textContent = timeStr;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Initialization
  async function init() {
    setupEventListeners();
    setupVideoPlayer();

    if (!state.deviceToken) {
      showPairingView();
    } else {
      await loadData();
    }
  }

  // Network Calls
  async function loadData() {
    showLoading(true, 'Carregando lista de categorias...');
    try {
      const headers = { 'Authorization': `Bearer ${state.deviceToken}` };

      // Load Status
      const statusRes = await fetch(`${state.serverUrl}/api/status`, { headers });
      const statusData = statusRes.ok ? await statusRes.json() : null;

      // Load Groups
      const groupRes = await fetch(`${state.serverUrl}/api/groups`, { headers });
      if (!groupRes.ok) throw new Error('Não autorizado ou servidor indisponível');
      const groupData = await groupRes.json();

      state.groups = groupData.groups || [];
      state.totalChannelsCount = statusData ? statusData.totalChannels : 0;
      state.favChannelsCount = statusData ? statusData.favoriteChannels : 0;

      renderSidebar();
      await selectSidebarCategory(0);
      showLoading(false);
      showMainView();
    } catch (err) {
      showLoading(false);
      console.error('Falha de conexão com servidor local:', err);
      showPairingView(err.message);
    }
  }

  // Render Sidebar
  function renderSidebar() {
    dom.sidebarMenu.innerHTML = '';

    // Fixed item: Favoritos
    const favItem = document.createElement('div');
    favItem.className = 'sidebar-item focusable';
    favItem.dataset.type = 'fav';
    favItem.innerHTML = `<span>⭐ Favoritos</span><span class="sidebar-badge">${state.favChannelsCount || 0}</span>`;
    dom.sidebarMenu.appendChild(favItem);

    // Fixed item: Todos os Canais
    const allItem = document.createElement('div');
    allItem.className = 'sidebar-item focusable';
    allItem.dataset.type = 'all';
    allItem.innerHTML = `<span>📺 Todos</span><span class="sidebar-badge">${state.totalChannelsCount || 0}</span>`;
    dom.sidebarMenu.appendChild(allItem);

    // Dynamic Groups
    state.groups.filter(g => !g.isHidden).forEach(g => {
      const gItem = document.createElement('div');
      gItem.className = 'sidebar-item focusable';
      gItem.dataset.type = 'group';
      gItem.dataset.name = g.name;
      gItem.innerHTML = `<span>${g.name}</span><span class="sidebar-badge">${g.count}</span>`;
      dom.sidebarMenu.appendChild(gItem);
    });

    updateSidebarSelection();
  }

  function updateSidebarSelection() {
    const items = dom.sidebarMenu.querySelectorAll('.sidebar-item');
    items.forEach((item, idx) => {
      if (idx === state.sidebarIndex) {
        item.classList.add('selected');
        if (state.focusArea === 'sidebar') {
          item.classList.add('focused');
          item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          item.classList.remove('focused');
        }
      } else {
        item.classList.remove('selected', 'focused');
      }
    });
  }

  async function selectSidebarCategory(index) {
    state.sidebarIndex = index;
    updateSidebarSelection();

    const items = dom.sidebarMenu.querySelectorAll('.sidebar-item');
    const selectedItem = items[index];
    if (!selectedItem) return;

    const type = selectedItem.dataset.type;
    const headers = { 'Authorization': `Bearer ${state.deviceToken}` };
    let url = `${state.serverUrl}/api/channels?limit=100`;

    if (type === 'fav') {
      url += '&favorites=true';
      dom.contentTitle.textContent = 'Canais Favoritos';
    } else if (type === 'all') {
      dom.contentTitle.textContent = 'Todos os Canais';
    } else if (type === 'group') {
      const gName = selectedItem.dataset.name;
      url += `&group=${encodeURIComponent(gName)}`;
      dom.contentTitle.textContent = gName;
    }

    try {
      const res = await fetch(url, { headers });
      const data = await res.json();
      state.filteredChannels = (data.channels || []).filter(c => !c.isHidden);
      dom.contentSubtitle.textContent = `${data.total || state.filteredChannels.length} canais disponíveis`;
      state.channelIndex = 0;
      renderChannels();
    } catch (err) {
      console.error('Falha ao carregar categoria:', err);
    }
  }

  // Render Channels
  function renderChannels() {
    dom.channelGrid.innerHTML = '';

    if (state.filteredChannels.length === 0) {
      dom.channelGrid.innerHTML = `<div style="grid-column: span 3; text-align: center; padding: 100px; font-size: 32px; color: var(--text-dim);">Nenhum canal nesta categoria.</div>`;
      return;
    }

    state.filteredChannels.forEach((ch, idx) => {
      const card = document.createElement('div');
      card.className = 'channel-card focusable';
      card.dataset.index = idx;

      const logoHtml = ch.logoUrl
        ? `<img src="${ch.logoUrl}" loading="lazy" class="channel-logo-img" onerror="this.outerHTML='<div class=\\'channel-logo-img\\' style=\\'display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold;\\'>TV</div>'">`
        : `<div class="channel-logo-img" style="display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold;">TV</div>`;

      card.innerHTML = `
        ${logoHtml}
        <div class="channel-card-details">
          <div class="channel-card-name">${idx + 1}. ${ch.name}</div>
          <div class="channel-card-epg">${ch.tvgName || ch.groupTitle}</div>
        </div>
      `;
      dom.channelGrid.appendChild(card);
    });

    updateChannelFocus();
  }

  function updateChannelFocus() {
    const cards = dom.channelGrid.querySelectorAll('.channel-card');
    cards.forEach((card, idx) => {
      if (state.focusArea === 'channels' && idx === state.channelIndex) {
        card.classList.add('focused');
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        card.classList.remove('focused');
      }
    });
  }

  // Video Player Logic
  function setupVideoPlayer() {
    const v = dom.videoPlayer;

    v.addEventListener('waiting', () => showLoading(true, 'Carregando stream...'));
    v.addEventListener('playing', () => {
      showLoading(false);
      showOsd();
    });
    v.addEventListener('error', (e) => {
      showLoading(false);
      const code = v.error ? v.error.code : 'Desconhecido';
      showError(`Não foi possível reproduzir este canal.\n(Código de erro: ${code})\nVerifique se o stream está online.`);
    });
  }

  function playChannel(index) {
    if (index < 0 || index >= state.filteredChannels.length) return;

    state.currentPlayingIndex = index;
    const channel = state.filteredChannels[index];

    // Update OSD info
    dom.osdChannelNum.textContent = `CANAL ${index + 1}`;
    dom.osdChannelName.textContent = channel.name;
    dom.osdGroupName.textContent = channel.groupTitle;
    dom.osdEpgTitle.textContent = channel.tvgName || 'Transmissão ao Vivo';

    // Switch View
    state.currentView = 'player';
    state.focusArea = 'player';
    dom.mainView.style.display = 'none';
    dom.playerContainer.style.display = 'block';

    showLoading(true, `Sintonizando ${channel.name}...`);
    dom.videoPlayer.src = channel.url;
    dom.videoPlayer.play().catch(err => {
      console.warn('Play falhou:', err);
    });
  }

  function showOsd() {
    dom.playerOsd.classList.add('visible');
    if (state.osdTimeout) clearTimeout(state.osdTimeout);
    state.osdTimeout = setTimeout(() => {
      dom.playerOsd.classList.remove('visible');
    }, 4500);
  }

  function stopPlayerAndReturn() {
    dom.videoPlayer.pause();
    dom.videoPlayer.removeAttribute('src');
    dom.videoPlayer.load();

    dom.playerContainer.style.display = 'none';
    dom.mainView.style.display = 'flex';
    state.currentView = 'main';
    state.focusArea = 'channels';
    updateChannelFocus();
  }

  // UI State Helpers
  function showLoading(show, message) {
    if (show) {
      dom.loadingOverlay.style.display = 'flex';
      const txt = dom.loadingOverlay.querySelector('.loading-text');
      if (txt && message) txt.textContent = message;
    } else {
      dom.loadingOverlay.style.display = 'none';
    }
  }

  function showError(msg) {
    dom.errorMessage.innerText = msg;
    dom.errorOverlay.style.display = 'flex';
    state.currentView = 'error';
    state.focusArea = 'error';

    const btn = document.getElementById('error-back-btn');
    if (btn) btn.classList.add('focused');
  }

  function hideError() {
    dom.errorOverlay.style.display = 'none';
    stopPlayerAndReturn();
  }

  function showPairingView(errorMsg) {
    state.currentView = 'pairing';
    state.focusArea = 'pairing';
    dom.mainView.style.display = 'none';
    dom.playerContainer.style.display = 'none';
    dom.pairingView.style.display = 'flex';

    dom.pairingServerInput.value = state.serverUrl;
    dom.pairingPinInput.value = '';
    if (errorMsg) {
      dom.pairingError.textContent = errorMsg;
      dom.pairingError.style.display = 'block';
    } else {
      dom.pairingError.style.display = 'none';
    }

    updatePairingFocus(0);
  }

  function showMainView() {
    state.currentView = 'main';
    state.focusArea = 'sidebar';
    dom.pairingView.style.display = 'none';
    dom.playerContainer.style.display = 'none';
    dom.mainView.style.display = 'flex';
    updateSidebarSelection();
  }

  let pairingFocusIdx = 0;
  function updatePairingFocus(idx) {
    pairingFocusIdx = idx;
    const items = [dom.pairingServerInput, dom.pairingPinInput, document.getElementById('pairing-submit-btn')];
    items.forEach((item, i) => {
      if (i === idx) {
        item.classList.add('focused');
        item.focus();
      } else {
        item.classList.remove('focused');
      }
    });
  }

  async function submitPairing() {
    const server = dom.pairingServerInput.value.trim().replace(/\/$/, '');
    const pin = dom.pairingPinInput.value.trim();

    if (!pin || pin.length !== 6) {
      dom.pairingError.textContent = 'Digite o PIN de 6 dígitos gerado no painel web.';
      dom.pairingError.style.display = 'block';
      return;
    }

    showLoading(true, 'Pareando TV com servidor local...');
    try {
      const res = await fetch(`${server}/api/devices/pair/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          deviceId: state.deviceId,
          deviceName: 'LG 43UA7500PSA (webOS 25)',
        }),
      });

      const data = await res.json();
      showLoading(false);

      if (res.ok && data.token) {
        state.serverUrl = server;
        state.deviceToken = data.token;
        localStorage.setItem('iptv_server_url', server);
        localStorage.setItem('iptv_device_token', data.token);

        dom.pairingView.style.display = 'none';
        await loadData();
      } else {
        dom.pairingError.textContent = data.error || 'PIN incorreto ou expirado';
        dom.pairingError.style.display = 'block';
      }
    } catch (err) {
      showLoading(false);
      dom.pairingError.textContent = 'Não foi possível conectar ao servidor: ' + err.message;
      dom.pairingError.style.display = 'block';
    }
  }

  // Key Event Navigation Handler
  function setupEventListeners() {
    window.addEventListener('keydown', handleKeyDown);

    // Click handler fallback for mouse/magic remote pointer
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.channel-card');
      if (card) {
        const idx = parseInt(card.dataset.index, 10);
        playChannel(idx);
      }
      const sideItem = e.target.closest('.sidebar-item');
      if (sideItem) {
        const items = Array.from(dom.sidebarMenu.querySelectorAll('.sidebar-item'));
        const idx = items.indexOf(sideItem);
        if (idx !== -1) selectSidebarCategory(idx);
      }
    });
  }

  function handleKeyDown(e) {
    const key = e.keyCode;

    // View: ERROR
    if (state.currentView === 'error') {
      if (key === KEYS.ENTER || key === KEYS.BACK || key === KEYS.BACK_BROWSER) {
        hideError();
      }
      return;
    }

    // View: PAIRING
    if (state.currentView === 'pairing') {
      if (key === KEYS.UP) {
        updatePairingFocus(Math.max(0, pairingFocusIdx - 1));
      } else if (key === KEYS.DOWN) {
        updatePairingFocus(Math.min(2, pairingFocusIdx + 1));
      } else if (key === KEYS.ENTER && pairingFocusIdx === 2) {
        submitPairing();
      }
      return;
    }

    // View: PLAYER (Fullscreen)
    if (state.currentView === 'player') {
      if (key === KEYS.BACK || key === KEYS.BACK_BROWSER) {
        stopPlayerAndReturn();
      } else if (key === KEYS.ENTER) {
        showOsd();
      } else if (key === KEYS.UP || key === KEYS.CH_UP) {
        // Next channel
        const nextIdx = (state.currentPlayingIndex + 1) % state.filteredChannels.length;
        playChannel(nextIdx);
      } else if (key === KEYS.DOWN || key === KEYS.CH_DOWN) {
        // Prev channel
        const prevIdx = (state.currentPlayingIndex - 1 + state.filteredChannels.length) % state.filteredChannels.length;
        playChannel(prevIdx);
      } else if (key === KEYS.PLAY) {
        dom.videoPlayer.play();
      } else if (key === KEYS.PAUSE) {
        dom.videoPlayer.pause();
      }
      return;
    }

    // View: MAIN (Navigation)
    if (state.currentView === 'main') {
      if (state.focusArea === 'sidebar') {
        const items = dom.sidebarMenu.querySelectorAll('.sidebar-item');
        if (key === KEYS.UP) {
          state.sidebarIndex = Math.max(0, state.sidebarIndex - 1);
          selectSidebarCategory(state.sidebarIndex);
        } else if (key === KEYS.DOWN) {
          state.sidebarIndex = Math.min(items.length - 1, state.sidebarIndex + 1);
          selectSidebarCategory(state.sidebarIndex);
        } else if (key === KEYS.RIGHT || key === KEYS.ENTER) {
          if (state.filteredChannels.length > 0) {
            state.focusArea = 'channels';
            updateSidebarSelection();
            updateChannelFocus();
          }
        }
      } else if (state.focusArea === 'channels') {
        const total = state.filteredChannels.length;
        const cols = 3;

        if (key === KEYS.LEFT) {
          if (state.channelIndex % cols === 0) {
            // Return to sidebar
            state.focusArea = 'sidebar';
            updateChannelFocus();
            updateSidebarSelection();
          } else {
            state.channelIndex = Math.max(0, state.channelIndex - 1);
            updateChannelFocus();
          }
        } else if (key === KEYS.RIGHT) {
          if (state.channelIndex < total - 1) {
            state.channelIndex++;
            updateChannelFocus();
          }
        } else if (key === KEYS.UP) {
          if (state.channelIndex - cols >= 0) {
            state.channelIndex -= cols;
            updateChannelFocus();
          }
        } else if (key === KEYS.DOWN) {
          if (state.channelIndex + cols < total) {
            state.channelIndex += cols;
            updateChannelFocus();
          }
        } else if (key === KEYS.ENTER) {
          playChannel(state.channelIndex);
        } else if (key === KEYS.BACK || key === KEYS.BACK_BROWSER) {
          // Return focus to sidebar
          state.focusArea = 'sidebar';
          updateChannelFocus();
          updateSidebarSelection();
        }
      }
    }
  }

  // Expose pairing submit button
  window.submitPairing = submitPairing;
  window.hideError = hideError;

  window.addEventListener('DOMContentLoaded', init);
})();
