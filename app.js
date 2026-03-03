/* =====================================================
   LaunchLog — Universal Space Launch Tracker
   app.js — All data fetching, rendering, interactions
   ===================================================== */

const API = 'https://ll.thespacedevs.com/2.2.0';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ── State ────────────────────────────────────────────
let state = {
  tab: 'upcoming',          // 'upcoming' | 'past'
  launches: [],             // raw API data for current tab
  filtered: [],             // after search/filter
  nextUrl: null,            // pagination URL
  countdownInterval: null,
  nextLaunch: null,
  agencySet: new Set(),
  loading: false,
  pastCache: null,          // preloaded past launches
  pastNextUrl: null,
};

// ── Country Code → Flag emoji ────────────────────────
function flagEmoji(code) {
  if (!code) return '🌍';
  const map = {
    USA: '🇺🇸', RUS: '🇷🇺', CHN: '🇨🇳', IND: '🇮🇳', EU: '🇪🇺',
    JPN: '🇯🇵', KOR: '🇰🇷', NZL: '🇳🇿', AUS: '🇦🇺', GBR: '🇬🇧',
    IRN: '🇮🇷', ISR: '🇮🇱', PRK: '🇰🇵', FRA: '🇫🇷', UKR: '🇺🇦',
    BRA: '🇧🇷', CAN: '🇨🇦', ARE: '🇦🇪', MYS: '🇲🇾', MMR: '🇲🇲',
  };
  // Try first 2 chars as regional indicator
  const letters = (map[code] || undefined);
  if (letters) return letters;
  // Fallback: convert 2-letter ISO to emoji
  if (code.length === 2) {
    const offset = 127397;
    return [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + offset)).join('');
  }
  return '🌍';
}

// ── Status → badge class & label ────────────────────
function statusBadge(status) {
  const abbrev = status?.abbrev || '';
  const name = status?.name || 'Unknown';
  const map = {
    'Go': ['badge--go', '● GO'],
    'Success': ['badge--success', '✓ SUCCESS'],
    'TBD': ['badge--tbd', '? TBD'],
    'TBC': ['badge--tbd', '? TBC'],
    'Hold': ['badge--hold', '⏸ HOLD'],
    'Failure': ['badge--fail', '✕ FAILURE'],
    'Partial Failure': ['badge--fail', '⚠ PARTIAL FAIL'],
    'In Flight': ['badge--live', '🔴 LIVE'],
  };
  const [cls, label] = map[abbrev] || ['badge--tbd', name.toUpperCase()];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── Format date string ───────────────────────────────
function formatDate(isoString, precision) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const opts = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
  if (precision?.id >= 2) {
    // Low precision — month/year only
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return d.toLocaleString(undefined, opts);
}

// ── Countdown calculation ────────────────────────────
function calcCountdown(isoString) {
  const target = new Date(isoString).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return null; // already launched
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

function pad(n) { return String(n).padStart(2, '0'); }

// ── Stars Background ─────────────────────────────────
function generateStars() {
  const container = document.getElementById('stars');
  const N = 130;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < N; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    star.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      --dur:${3 + Math.random() * 5}s;
      --delay:${Math.random() * 5}s;
    `;
    frag.appendChild(star);
  }
  container.appendChild(frag);
}

// ── Cache ─────────────────────────────────────────────
function getCached(key) {
  try {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    const { ts, data } = JSON.parse(item);
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch { }
}

// ── Fetch launches ────────────────────────────────────
async function fetchLaunches(url) {
  const cached = getCached(url);
  if (cached) return cached;

  const res = await fetch(url);
  if (res.status === 429) {
    const err = new Error('RATE_LIMITED');
    err.rateLimited = true;
    throw err;
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  setCache(url, data);
  return data;
}

// ── Silently preload past launches in background ──────
async function preloadPastLaunches() {
  try {
    const url = `${API}/launch/past/?limit=20&ordering=-net`;
    const data = await fetchLaunches(url);
    state.pastCache = data.results || [];
    state.pastNextUrl = data.next;
  } catch {
    // Silent — tab will handle errors on demand
  }
}

// ── Build agency filter dropdown ──────────────────────
function populateAgencyDropdown() {
  const sel = document.getElementById('filterAgency');
  // Clear existing options beyond first
  while (sel.options.length > 1) sel.remove(1);
  const sorted = [...state.agencySet].sort();
  for (const name of sorted) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  }
}

// ── Mini countdown for cards ──────────────────────────
function miniCountdown(isoString) {
  const t = calcCountdown(isoString);
  if (!t) return 'Launched';
  if (t.d > 0) return `T-${t.d}d ${pad(t.h)}h`;
  if (t.h > 0) return `T-${t.h}h ${pad(t.m)}m`;
  return `T-${pad(t.m)}m ${pad(t.s)}s`;
}

// ── Render a single launch card ───────────────────────
function renderCard(launch) {
  const { name, status, net, net_precision, launch_service_provider: lsp, rocket, mission, pad, image, webcast_live } = launch;

  const rocketName = rocket?.configuration?.full_name || rocket?.configuration?.name || 'Unknown Rocket';
  const agency = lsp?.name || 'Unknown Agency';
  const countryCode = lsp?.country_code || '';
  const flag = flagEmoji(countryCode.split(',')[0].trim());
  const padName = pad?.name || '—';
  const location = pad?.location?.name || '—';
  const orbit = mission?.orbit?.abbrev || '—';
  const missionType = mission?.type || '—';
  const isUpcoming = state.tab === 'upcoming';

  const imgHTML = image
    ? `<img class="card-img" src="${image}" alt="${name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="card-img-placeholder" style="display:none">🚀</div>`
    : `<div class="card-img-placeholder">🚀</div>`;

  const cdMini = isUpcoming ? `<span class="card-countdown-mini" data-net="${net}">${miniCountdown(net)}</span>` : '';

  return `
  <div class="launch-card" onclick="openModal('${launch.id}')" id="card-${launch.id}">
    <div style="position:relative">
      ${imgHTML}
      <div class="card-img-overlay"></div>
      ${webcast_live ? '<span class="badge badge--live" style="position:absolute;top:12px;left:12px;z-index:1">🔴 LIVE NOW</span>' : ''}
    </div>
    <div class="card-body">
      <div class="card-header">
        <div class="card-mission">${name}</div>
        ${statusBadge(status)}
      </div>
      <div class="card-agency">
        <span class="card-agency-flag">${flag}</span>
        ${agency} · ${rocketName}
      </div>
      <div class="card-details">
        <div class="card-detail">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${padName}</span>
        </div>
        <div class="card-detail">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>${formatDate(net, net_precision)}</span>
        </div>
        <div class="card-detail">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-10"/></svg>
          Orbit: <span>${orbit}</span> &nbsp;·&nbsp; Type: <span>${missionType}</span>
        </div>
      </div>
      <div class="card-footer">
        <span class="card-date">${location}</span>
        ${cdMini}
      </div>
    </div>
  </div>`;
}

// ── Render grid ───────────────────────────────────────
function renderGrid(launches, append = false) {
  const grid = document.getElementById('launchGrid');
  const noResults = document.getElementById('noResults');
  const count = document.getElementById('sectionCount');

  if (!append) grid.innerHTML = '';

  if (launches.length === 0 && !append) {
    noResults.style.display = 'block';
    grid.style.display = 'none';
    count.textContent = '';
    return;
  }

  noResults.style.display = 'none';
  grid.style.display = 'grid';
  count.textContent = `${state.filtered.length} launches`;

  const frag = document.createDocumentFragment();
  for (const l of launches) {
    const div = document.createElement('div');
    div.innerHTML = renderCard(l);
    frag.appendChild(div.firstElementChild);
  }
  grid.appendChild(frag);
}

// ── Hero section ──────────────────────────────────────
function renderHero(launch) {
  if (!launch) return;
  state.nextLaunch = launch;

  const title = document.getElementById('heroTitle');
  const subtitle = document.getElementById('heroSubtitle');
  const heroMeta = document.getElementById('heroMeta');
  const heroStatus = document.getElementById('heroStatus');
  const heroNet = document.getElementById('heroNet');
  const heroImg = document.getElementById('heroImg');

  const agency = launch.launch_service_provider?.name || '—';
  const rocket = launch.rocket?.configuration?.full_name || launch.rocket?.configuration?.name || '—';
  const pad = launch.pad?.name || '—';
  const location = launch.pad?.location?.name || '—';
  const orbit = launch.mission?.orbit?.name || '—';
  const countryCode = launch.launch_service_provider?.country_code || '';
  const flag = flagEmoji(countryCode.split(',')[0].trim());

  title.textContent = launch.name;
  subtitle.textContent = launch.mission?.description || `${rocket} mission`;

  heroMeta.innerHTML = `
    <div class="hero-tag"><span>${flag}</span>${agency}</div>
    <div class="hero-tag">🚀 <span>${rocket}</span></div>
    <div class="hero-tag">📍 <span>${pad}, ${location}</span></div>
    <div class="hero-tag">🌐 <span>${orbit}</span></div>
  `;

  heroStatus.innerHTML = statusBadge(launch.status);
  heroNet.textContent = `NET: ${formatDate(launch.net, launch.net_precision)}`;

  if (launch.image) {
    heroImg.style.backgroundImage = `url(${launch.image})`;
    heroImg.style.opacity = '0.18';
  }

  if (launch.webcast_live) {
    document.getElementById('liveText').textContent = 'LIVE NOW';
    document.querySelector('.nav-status .dot').classList.add('dot--pulse');
    document.querySelector('.nav-status .dot').classList.remove('dot--live');
  } else {
    document.getElementById('liveText').textContent = `${state.launches.length}+ launches tracked`;
  }

  // Start countdown
  startCountdown(launch.net);
}

// ── Countdown ─────────────────────────────────────────
function startCountdown(net) {
  if (state.countdownInterval) clearInterval(state.countdownInterval);

  function tick() {
    const t = calcCountdown(net);
    if (!t) {
      document.getElementById('cdDays').textContent = '00';
      document.getElementById('cdHours').textContent = '00';
      document.getElementById('cdMins').textContent = '00';
      document.getElementById('cdSecs').textContent = '00';
      clearInterval(state.countdownInterval);
      return;
    }
    document.getElementById('cdDays').textContent = pad(t.d);
    document.getElementById('cdHours').textContent = pad(t.h);
    document.getElementById('cdMins').textContent = pad(t.m);
    document.getElementById('cdSecs').textContent = pad(t.s);
  }

  tick();
  state.countdownInterval = setInterval(tick, 1000);
}

// ── Update mini countdowns on cards ──────────────────
function updateMiniCountdowns() {
  document.querySelectorAll('[data-net]').forEach(el => {
    el.textContent = miniCountdown(el.dataset.net);
  });
}

// ── Stats bar ─────────────────────────────────────────
function renderStats(apiData) {
  const first = apiData.results?.[0];
  if (!first) return;

  document.getElementById('statTotal').textContent = apiData.count?.toLocaleString() || '—';
  document.getElementById('statYear').textContent = first.orbital_launch_attempt_count_year?.toLocaleString() || '—';
  // Count unique agencies
  const agencies = new Set(apiData.results.map(l => l.launch_service_provider?.name).filter(Boolean));
  document.getElementById('statAgencies').textContent = agencies.size || '—';
  document.getElementById('statOrbital').textContent = first.orbital_launch_attempt_count?.toLocaleString() || '—';
}

// ── Load launches ─────────────────────────────────────
async function loadLaunches(append = false) {
  if (state.loading) return;
  state.loading = true;

  const errorEl = document.getElementById('errorState');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  errorEl.style.display = 'none';

  if (!append) {
    // Show skeleton
    const grid = document.getElementById('launchGrid');
    grid.style.display = 'grid';
    grid.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const sk = document.createElement('div');
      sk.className = 'launch-card skeleton';
      grid.appendChild(sk);
    }
    loadMoreWrap.style.display = 'none';
  } else {
    loadMoreBtn.textContent = 'Loading...';
    loadMoreBtn.classList.add('loading');
  }

  try {
    const endpoint = state.tab === 'upcoming'
      ? `/launch/upcoming/?limit=20&ordering=net`
      : `/launch/past/?limit=20&ordering=-net`;

    const url = append ? state.nextUrl : `${API}${endpoint}`;
    const data = await fetchLaunches(url);

    if (!append) {
      state.launches = data.results || [];
      state.filtered = [...state.launches];
      // Build agency list
      state.agencySet = new Set();
      state.launches.forEach(l => {
        if (l.launch_service_provider?.name) state.agencySet.add(l.launch_service_provider.name);
      });
      populateAgencyDropdown();
      renderStats(data);

      // Hero — first truly upcoming
      const upcoming = state.launches.find(l => new Date(l.net) > new Date()) || state.launches[0];
      if (upcoming) renderHero(upcoming);
    } else {
      const newLaunches = data.results || [];
      state.launches.push(...newLaunches);
      newLaunches.forEach(l => {
        if (l.launch_service_provider?.name) state.agencySet.add(l.launch_service_provider.name);
      });
      populateAgencyDropdown();
      applyFilters(true); // re-filter and append
    }

    state.nextUrl = data.next;
    loadMoreWrap.style.display = state.nextUrl ? 'flex' : 'none';

    if (!append) {
      applyFilters();
    }

    document.getElementById('sectionTitle').textContent = state.tab === 'upcoming' ? 'Upcoming Launches' : 'Past Launches';

  } catch (err) {
    console.error('Launch fetch error:', err);
    document.getElementById('launchGrid').innerHTML = '';
    const errMsg = errorEl.querySelector('p');
    if (err.rateLimited) {
      errMsg.textContent = 'Rate limit reached (15 req/hour on the free tier). Please wait a minute then click Retry.';
    } else {
      errMsg.textContent = 'The API may be temporarily unavailable or rate-limited (15 req/hour free tier). Please try again in a moment.';
    }
    errorEl.style.display = 'block';
    loadMoreWrap.style.display = 'none';
  } finally {
    state.loading = false;
    loadMoreBtn.textContent = '⟳ Load More Launches';
    loadMoreBtn.classList.remove('loading');
    loadMoreBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/></svg> Load More Launches`;
  }
}

// ── Filtering ─────────────────────────────────────────
let searchTimeout;

function handleSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearch');
  clearBtn.style.display = input.value ? 'block' : 'none';
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(applyFilters, 200);
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearch').style.display = 'none';
  applyFilters();
}

function applyFilters(appendMode = false) {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const agency = document.getElementById('filterAgency').value;
  const orbit = document.getElementById('filterOrbit').value;

  state.filtered = state.launches.filter(l => {
    const matchQuery = !query ||
      l.name.toLowerCase().includes(query) ||
      (l.launch_service_provider?.name || '').toLowerCase().includes(query) ||
      (l.rocket?.configuration?.name || '').toLowerCase().includes(query) ||
      (l.mission?.name || '').toLowerCase().includes(query);

    const matchAgency = !agency || l.launch_service_provider?.name === agency;
    const matchOrbit = !orbit || (l.mission?.orbit?.abbrev || '').toLowerCase().includes(orbit.toLowerCase());

    return matchQuery && matchAgency && matchOrbit;
  });

  renderGrid(state.filtered, false);
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterAgency').value = '';
  document.getElementById('filterOrbit').value = '';
  document.getElementById('clearSearch').style.display = 'none';
  applyFilters();
}

// ── Load More ─────────────────────────────────────────
function loadMore() {
  if (state.nextUrl) loadLaunches(true);
}

// ── Retry ─────────────────────────────────────────────
function retryLoad() {
  loadLaunches(false);
}

// ── Tab switch ────────────────────────────────────────
function switchTab(tab) {
  const prevTab = state.tab;
  state.tab = tab;

  document.getElementById('tabUpcoming').classList.toggle('active', tab === 'upcoming');
  document.getElementById('tabPast').classList.toggle('active', tab === 'past');
  document.getElementById('tabTracker').classList.toggle('active', tab === 'tracker');

  // Pause tracker intervals when leaving tracker tab
  if (prevTab === 'tracker' && tab !== 'tracker') {
    pauseTracker();
  }

  const isTracker = tab === 'tracker';
  const isLaunchTab = !isTracker;

  // Show / hide sections
  document.getElementById('trackerSection').style.display = isTracker ? 'block' : 'none';
  document.getElementById('hero').style.display = (tab === 'upcoming') ? '' : 'none';
  document.querySelector('.stats-bar').style.display = (tab === 'upcoming') ? '' : 'none';
  document.querySelector('.main').style.display = isLaunchTab ? '' : 'none';
  document.querySelector('.footer').style.display = isLaunchTab ? '' : 'none';

  if (isTracker) {
    resumeTracker();
    return;
  }

  document.getElementById('sectionTitle').textContent = tab === 'upcoming' ? 'Upcoming Launches' : 'Past Launches';
  resetFilters();

  // If past launches were preloaded, serve instantly without an API call
  if (tab === 'past' && state.pastCache) {
    state.launches = state.pastCache;
    state.filtered = [...state.launches];
    state.nextUrl = state.pastNextUrl;
    document.getElementById('launchGrid').innerHTML = '';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('loadMoreWrap').style.display = state.nextUrl ? 'flex' : 'none';
    applyFilters();
    return;
  }

  loadLaunches(false);
}


// ── Modal ─────────────────────────────────────────────
function openModal(launchId) {
  const launch = state.launches.find(l => l.id === launchId);
  if (!launch) return;

  const {
    name, status, net, net_precision, window_start, window_end,
    launch_service_provider: lsp, rocket, mission, pad, image,
    probability, webcast_live
  } = launch;

  const rocketName = rocket?.configuration?.full_name || rocket?.configuration?.name || '—';
  const agency = lsp?.name || '—';
  const flag = flagEmoji((lsp?.country_code || '').split(',')[0].trim());
  const padName = pad?.name || '—';
  const location = pad?.location?.name || '—';
  const orbit = mission?.orbit?.name || '—';
  const orbitAbbrev = mission?.orbit?.abbrev || '—';
  const missionType = mission?.type || '—';
  const desc = mission?.description || 'No mission description available.';
  const prob = probability != null ? `${probability}%` : '—';

  // Video URLs
  const vidUrls = mission?.vid_urls || [];
  const infoUrls = mission?.info_urls || [];

  const imgHTML = image
    ? `<img class="modal-rocket-img" src="${image}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="modal-rocket-placeholder" style="display:none">🚀</div>`
    : `<div class="modal-rocket-placeholder">🚀</div>`;

  const streamLinks = vidUrls.length > 0
    ? vidUrls.map(u => `<a class="stream-btn" href="${u.url}" target="_blank" rel="noopener">🔴 Watch Stream</a>`).join(' ')
    : (webcast_live ? `<span class="badge badge--live">🔴 LIVE NOW</span>` : '');

  const infoLinks = infoUrls.length > 0
    ? infoUrls.map(u => `<a href="${u.url}" target="_blank" rel="noopener" style="font-size:0.8rem;color:var(--cyan)">${u.url.replace(/^https?:\/\//, '').substring(0, 40)}…</a>`).join(' ')
    : '';

  document.getElementById('modalBody').innerHTML = `
    ${imgHTML}
    <div style="margin-bottom:14px">${statusBadge(status)}</div>
    <div class="modal-title">${name}</div>
    <div class="modal-agency">${flag} ${agency} · ${rocketName}</div>

    <div class="modal-section">
      <div class="modal-section-title">Launch Details</div>
      <div class="modal-grid">
        <div class="modal-field">
          <span class="modal-field-label">NET T-0</span>
          <span class="modal-field-val">${formatDate(net, net_precision)}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field-label">Window</span>
          <span class="modal-field-val">${net_precision?.id <= 1 ? formatDate(window_start, net_precision) + ' → ' + formatDate(window_end, net_precision) : 'TBD'}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field-label">Launch Pad</span>
          <span class="modal-field-val">${padName}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field-label">Location</span>
          <span class="modal-field-val">${location}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field-label">Orbit</span>
          <span class="modal-field-val">${orbit} (${orbitAbbrev})</span>
        </div>
        <div class="modal-field">
          <span class="modal-field-label">Mission Type</span>
          <span class="modal-field-val">${missionType}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field-label">Weather Probability</span>
          <span class="modal-field-val" style="color:var(--cyan)">${prob}</span>
        </div>
        <div class="modal-field">
          <span class="modal-field-label">Rocket</span>
          <span class="modal-field-val">${rocketName}</span>
        </div>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Mission</div>
      <p class="modal-description">${desc}</p>
    </div>

    ${streamLinks || infoLinks ? `
    <div class="modal-section modal-stream">
      <div class="modal-section-title">Media & Links</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px">
        ${streamLinks}
        ${infoLinks}
      </div>
    </div>` : ''}
  `;

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Scroll-triggered nav shadow ───────────────────────
window.addEventListener('scroll', () => {
  const nav = document.getElementById('mainNav');
  nav.style.background = window.scrollY > 20
    ? 'rgba(7, 7, 16, 0.97)'
    : 'rgba(7, 7, 16, 0.8)';
}, { passive: true });

// ── Mini countdown refresh ────────────────────────────
setInterval(updateMiniCountdowns, 5000);

// ── Init ──────────────────────────────────────────────
(async function init() {
  generateStars();
  await loadLaunches(false);
  // Preload past launches quietly 2s after startup so tab switch is instant
  setTimeout(preloadPastLaunches, 2000);
})();
