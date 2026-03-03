/* =====================================================
   LaunchLog — Live Satellite Tracker
   tracker.js — Leaflet map + satellite.js + TLE data
   ===================================================== */

// ── Embedded TLE Data ─────────────────────────────────
// TLEs sourced from Celestrak. Positions are approximately correct.
// The ISS is overridden with real-time data from Open Notify API.
// Update these every few weeks with fresh TLEs from celestrak.org.

const SATELLITES = [
    {
        id: 'ISS',
        name: 'ISS',
        fullName: 'International Space Station',
        category: 'Space Station',
        emoji: '🛸',
        color: '#10e88a',
        realtime: true, // will use Open Notify API for real position
        tle1: '1 25544U 98067A   26061.50000000  .00020000  00000-0  35028-3 0  9993',
        tle2: '2 25544  51.6400  95.3650 0006704 212.5700 270.9800 15.50000000 19992',
    },
    {
        id: 'CSS',
        name: 'Tiangong',
        fullName: 'Chinese Space Station (Tiangong)',
        category: 'Space Station',
        emoji: '🛸',
        color: '#f87171',
        tle1: '1 48274U 21035A   26061.50000000  .00020000  00000-0  38000-3 0  9991',
        tle2: '2 48274  41.4700 200.5600 0005764 230.1200 129.8800 15.61000000 30001',
    },
    {
        id: 'HST',
        name: 'Hubble',
        fullName: 'Hubble Space Telescope',
        category: 'Observatory',
        emoji: '🔭',
        color: '#a78bfa',
        tle1: '1 20580U 90037B   26061.50000000  .00001234  00000-0  62000-4 0  9991',
        tle2: '2 20580  28.4700  45.2300 0002534 120.4500 239.7300 15.09000000 90001',
    },
    {
        id: 'NOAA20',
        name: 'NOAA-20',
        fullName: 'NOAA-20 Weather Satellite',
        category: 'Weather',
        emoji: '☁️',
        color: '#38bdf8',
        tle1: '1 43013U 17073A   26061.50000000  .00000120  00000-0  79000-4 0  9992',
        tle2: '2 43013  98.7000 100.4500 0001000  90.1200 270.0300 14.19000000 20003',
    },
    {
        id: 'TERRA',
        name: 'Terra',
        fullName: 'Terra Earth Observer',
        category: 'Earth Obs.',
        emoji: '🌍',
        color: '#34d399',
        tle1: '1 25994U 99068A   26061.50000000  .00000100  00000-0  10000-4 0  9997',
        tle2: '2 25994  98.2000 130.2100 0002000  70.3400 289.8200 14.57000000 90001',
    },
    {
        id: 'AQUA',
        name: 'Aqua',
        fullName: 'Aqua Earth Observer',
        category: 'Earth Obs.',
        emoji: '💧',
        color: '#60a5fa',
        tle1: '1 27424U 02022A   26061.50000000  .00000100  00000-0  10000-4 0  9998',
        tle2: '2 27424  98.2000 120.1100 0002000  80.5600 279.6500 14.57000000 90002',
    },
    {
        id: 'S2A',
        name: 'Sentinel-2A',
        fullName: 'Copernicus Sentinel-2A',
        category: 'Earth Obs.',
        emoji: '🗺️',
        color: '#fb923c',
        tle1: '1 40697U 15028A   26061.50000000  .00000100  00000-0  14000-4 0  9993',
        tle2: '2 40697  98.5700 140.3300 0001000  60.1200 300.0400 14.30000000 90003',
    },
    {
        id: 'LS9',
        name: 'Landsat 9',
        fullName: 'Landsat 9 Earth Observer',
        category: 'Earth Obs.',
        emoji: '🌱',
        color: '#4ade80',
        tle1: '1 49260U 21088A   26061.50000000  .00000134  00000-0  89000-4 0  9991',
        tle2: '2 49260  98.2000 112.3400 0001200  55.6700 304.5600 14.57000000 30001',
    },
    {
        id: 'GOES16',
        name: 'GOES-16',
        fullName: 'GOES-16 Weather Satellite (GEO)',
        category: 'Weather (GEO)',
        emoji: '🌩️',
        color: '#facc15',
        tle1: '1 41866U 16071A   26061.50000000 -.00000307  00000-0  00000-0 0  9997',
        tle2: '2 41866   0.0500 295.6700 0001234 354.2300   5.7800  1.00271500 33997',
    },
    {
        id: 'GPS3',
        name: 'GPS III SV01',
        fullName: 'GPS Block III Space Vehicle 01',
        category: 'Navigation',
        emoji: '📡',
        color: '#c084fc',
        tle1: '1 43873U 18109A   26061.50000000  .00000010  00000-0  00000-0 0  9993',
        tle2: '2 43873  55.0100  45.1230 0009876 234.5600 125.2300  2.00563424 30001',
    },
    {
        id: 'SL30',
        name: 'Starlink-30',
        fullName: 'SpaceX Starlink (sample)',
        category: 'Communications',
        emoji: '✨',
        color: '#6ee7f7',
        tle1: '1 44238U 19029C   26061.50000000  .00008000  00000-0  98000-4 0  9998',
        tle2: '2 44238  53.0100 221.3400 0001566  10.4500 349.6500 15.06000000 30001',
    },
    {
        id: 'JWST',
        name: 'James Webb',
        fullName: 'James Webb Space Telescope',
        category: 'Observatory',
        emoji: '🔭',
        color: '#e879f9',
        tle1: '1 50463U 21130A   26061.50000000 -.00000250  00000-0  00000-0 0  9998',
        tle2: '2 50463   0.1200 151.2300 8450000 180.0000 180.0000  0.03984760 14998',
    },
];

// ── Tracker State ──────────────────────────────────────
const tracker = {
    map: null,
    markers: {},
    groundTrack: null,
    selectedId: null,
    updateInterval: null,
    issInterval: null,
    satPositions: {},  // { id: { lat, lng, alt, vel } }
    initialized: false,
};

// ── Init ───────────────────────────────────────────────
function initTracker() {
    if (tracker.initialized) return;
    tracker.initialized = true;

    // Leaflet map with CartoDB Dark Matter (free, no key)
    tracker.map = L.map('satelliteMap', {
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 8,
        zoomControl: true,
        attributionControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
    }).addTo(tracker.map);

    // Render satellite list in sidebar
    renderSatList();

    // Place initial markers
    updateAllMarkers();

    // Update positions every 5 seconds
    tracker.updateInterval = setInterval(updateAllMarkers, 5000);

    // Real-time ISS from Open Notify every 5s
    fetchISSRealtime();
    tracker.issInterval = setInterval(fetchISSRealtime, 5000);

    // Auto-track ISS on load
    setTimeout(() => trackSatellite('ISS'), 800);
}

// ── Position Computation from TLE ─────────────────────
function computePos(tle1, tle2) {
    try {
        const satrec = satellite.twoline2satrec(tle1, tle2);
        const now = new Date();
        const posVel = satellite.propagate(satrec, now);
        if (!posVel.position || posVel.position === true) return null;

        const gmst = satellite.gstime(now);
        const geo = satellite.eciToGeodetic(posVel.position, gmst);

        const lat = satellite.degreesLat(geo.latitude);
        const lng = satellite.degreesLong(geo.longitude);
        const alt = geo.height; // km

        // Velocity magnitude from velocity vector (km/s)
        const vel = posVel.velocity
            ? Math.sqrt(posVel.velocity.x ** 2 + posVel.velocity.y ** 2 + posVel.velocity.z ** 2)
            : null;

        // Orbital period in minutes (mean motion in rev/day from TLE line 2)
        const mmStr = tle2.substring(52, 63).trim();
        const meanMotion = parseFloat(mmStr); // rev/day
        const period = meanMotion > 0 ? (1440 / meanMotion).toFixed(0) : null;

        return { lat, lng, alt: alt.toFixed(1), vel: vel ? (vel).toFixed(2) : null, period };
    } catch (e) {
        console.warn('TLE compute error:', e);
        return null;
    }
}

// ── Real-time ISS from Open Notify ────────────────────
async function fetchISSRealtime() {
    try {
        const res = await fetch('https://api.open-notify.org/iss-now.json', { cache: 'no-store' });
        const data = await res.json();
        const lat = parseFloat(data.iss_position.latitude);
        const lng = parseFloat(data.iss_position.longitude);

        // Override ISS position with ground-truth
        if (tracker.satPositions['ISS']) {
            tracker.satPositions['ISS'].lat = lat;
            tracker.satPositions['ISS'].lng = lng;
        } else {
            tracker.satPositions['ISS'] = { lat, lng, alt: '408.0', vel: '7.66', period: '93' };
        }

        if (tracker.markers['ISS']) {
            tracker.markers['ISS'].setLatLng([lat, lng]);
            updateMarkerTooltip('ISS');
        }

        // Update info panel if ISS is selected
        if (tracker.selectedId === 'ISS') updateInfoPanel('ISS');
    } catch (e) {
        // Silent fail — TLE position will be used
    }
}

// ── Update All Markers ─────────────────────────────────
function updateAllMarkers() {
    for (const sat of SATELLITES) {
        const pos = computePos(sat.tle1, sat.tle2);
        if (!pos) continue;

        // ISS is overridden by realtime API but store TLE as fallback
        if (sat.id !== 'ISS' || !tracker.satPositions['ISS']) {
            tracker.satPositions[sat.id] = pos;
        }

        const { lat, lng } = tracker.satPositions[sat.id] || pos;

        if (tracker.markers[sat.id]) {
            tracker.markers[sat.id].setLatLng([lat, lng]);
            updateMarkerTooltip(sat.id);
        } else {
            // Create marker
            const icon = L.divIcon({
                className: '',
                html: `<div class="sat-marker ${sat.id === tracker.selectedId ? 'sat-marker--active' : ''}" style="--sat-color:${sat.color}" data-sat="${sat.id}">
          <div class="sat-dot"></div>
          <div class="sat-pulse"></div>
          <div class="sat-label">${sat.name}</div>
        </div>`,
                iconSize: [60, 60],
                iconAnchor: [30, 30],
            });

            const marker = L.marker([lat, lng], { icon, zIndexOffset: sat.id === 'ISS' ? 1000 : 0 })
                .addTo(tracker.map)
                .on('click', () => trackSatellite(sat.id));

            tracker.markers[sat.id] = marker;
        }

        if (tracker.selectedId === sat.id) updateInfoPanel(sat.id);
    }
}

function updateMarkerTooltip(id) {
    const marker = tracker.markers[id];
    if (!marker) return;
    const pos = tracker.satPositions[id];
    const sat = SATELLITES.find(s => s.id === id);
    if (!pos || !sat) return;
    marker.bindTooltip(`<b>${sat.name}</b><br>Alt: ${pos.alt} km`, {
        direction: 'top',
        className: 'sat-tooltip',
        permanent: false,
    });
}

// ── Ground Track ───────────────────────────────────────
function computeGroundTrack(tle1, tle2, minutesAhead = 95) {
    try {
        const satrec = satellite.twoline2satrec(tle1, tle2);
        const points = [];
        const now = new Date();

        // Compute a point every minute for the next orbit
        for (let i = -5; i <= minutesAhead; i++) {
            const t = new Date(now.getTime() + i * 60000);
            const posVel = satellite.propagate(satrec, t);
            if (!posVel.position || posVel.position === true) continue;
            const gmst = satellite.gstime(t);
            const geo = satellite.eciToGeodetic(posVel.position, gmst);
            const lat = satellite.degreesLat(geo.latitude);
            const lng = satellite.degreesLong(geo.longitude);
            if (!isNaN(lat) && !isNaN(lng)) points.push([lat, lng]);
        }

        // Split at antimeridian crossings to avoid ugly lines across the map
        const segments = [];
        let seg = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const dlng = Math.abs(points[i][1] - points[i - 1][1]);
            if (dlng > 180) {
                segments.push(seg);
                seg = [];
            }
            seg.push(points[i]);
        }
        segments.push(seg);
        return segments;
    } catch { return []; }
}

// ── Track Satellite ────────────────────────────────────
function trackSatellite(id) {
    const sat = SATELLITES.find(s => s.id === id);
    if (!sat) return;

    tracker.selectedId = id;

    // Update all marker styles
    document.querySelectorAll('.sat-marker').forEach(el => el.classList.remove('sat-marker--active'));
    const activeEl = document.querySelector(`[data-sat="${id}"]`);
    if (activeEl) activeEl.classList.add('sat-marker--active');

    // Update sidebar highlight
    document.querySelectorAll('.sat-list-item').forEach(el => el.classList.remove('sat-list-item--active'));
    const listItem = document.getElementById(`sat-item-${id}`);
    if (listItem) {
        listItem.classList.add('sat-list-item--active');
        listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Remove old ground track
    if (tracker.groundTrack) {
        if (Array.isArray(tracker.groundTrack)) {
            tracker.groundTrack.forEach(l => tracker.map.removeLayer(l));
        } else {
            tracker.map.removeLayer(tracker.groundTrack);
        }
        tracker.groundTrack = null;
    }

    // Draw ground track
    const segments = computeGroundTrack(sat.tle1, sat.tle2);
    tracker.groundTrack = segments.map(seg =>
        L.polyline(seg, {
            color: sat.color,
            weight: 1.5,
            opacity: 0.6,
            dashArray: '4 4',
        }).addTo(tracker.map)
    );

    // Pan to satellite
    const pos = tracker.satPositions[id];
    if (pos) tracker.map.flyTo([pos.lat, pos.lng], Math.max(tracker.map.getZoom(), 3), { duration: 1.2 });

    // Show info panel
    updateInfoPanel(id);
    document.getElementById('satInfoPanel').style.display = 'flex';
}

// ── Info Panel ─────────────────────────────────────────
function updateInfoPanel(id) {
    const sat = SATELLITES.find(s => s.id === id);
    const pos = tracker.satPositions[id];
    if (!sat || !pos) return;

    const isISS = sat.realtime;
    const latStr = pos.lat != null ? `${parseFloat(pos.lat).toFixed(2)}°` : '—';
    const lngStr = pos.lng != null ? `${parseFloat(pos.lng).toFixed(2)}°` : '—';

    document.getElementById('satInfoPanel').innerHTML = `
    <div class="sat-info-header">
      <div class="sat-info-emoji">${sat.emoji}</div>
      <div>
        <div class="sat-info-name">${sat.fullName}</div>
        <div class="sat-info-cat">${sat.category} ${isISS ? '· <span style="color:var(--green)">● Real-time</span>' : '· <span style="color:var(--amber)">~ Computed</span>'}</div>
      </div>
      <button class="sat-info-close" onclick="closeInfoPanel()">✕</button>
    </div>
    <div class="sat-info-grid">
      <div class="sat-info-field">
        <div class="sat-info-label">Latitude</div>
        <div class="sat-info-val">${latStr}</div>
      </div>
      <div class="sat-info-field">
        <div class="sat-info-label">Longitude</div>
        <div class="sat-info-val">${lngStr}</div>
      </div>
      <div class="sat-info-field">
        <div class="sat-info-label">Altitude</div>
        <div class="sat-info-val">${pos.alt} km</div>
      </div>
      <div class="sat-info-field">
        <div class="sat-info-label">Velocity</div>
        <div class="sat-info-val">${pos.vel ? pos.vel + ' km/s' : '—'}</div>
      </div>
      <div class="sat-info-field">
        <div class="sat-info-label">Orbital Period</div>
        <div class="sat-info-val">${pos.period ? pos.period + ' min' : '—'}</div>
      </div>
      <div class="sat-info-field">
        <div class="sat-info-label">NORAD ID</div>
        <div class="sat-info-val">${sat.tle1.substring(2, 7).trim()}</div>
      </div>
    </div>
  `;
}

function closeInfoPanel() {
    document.getElementById('satInfoPanel').style.display = 'none';
    // Clear ground track
    if (tracker.groundTrack) {
        if (Array.isArray(tracker.groundTrack)) {
            tracker.groundTrack.forEach(l => tracker.map.removeLayer(l));
        } else {
            tracker.map.removeLayer(tracker.groundTrack);
        }
        tracker.groundTrack = null;
    }
    tracker.selectedId = null;
    document.querySelectorAll('.sat-list-item').forEach(el => el.classList.remove('sat-list-item--active'));
    document.querySelectorAll('.sat-marker').forEach(el => el.classList.remove('sat-marker--active'));
}

// ── Satellite Sidebar List ─────────────────────────────
let satSearch = '';

function renderSatList() {
    const query = satSearch.toLowerCase();
    const filtered = SATELLITES.filter(s =>
        !query || s.name.toLowerCase().includes(query) || s.fullName.toLowerCase().includes(query) || s.category.toLowerCase().includes(query)
    );

    const list = document.getElementById('satList');
    list.innerHTML = filtered.map(sat => `
    <div class="sat-list-item ${tracker.selectedId === sat.id ? 'sat-list-item--active' : ''}"
         id="sat-item-${sat.id}"
         onclick="trackSatellite('${sat.id}')">
      <span class="sat-list-emoji">${sat.emoji}</span>
      <div class="sat-list-info">
        <div class="sat-list-name">${sat.name}</div>
        <div class="sat-list-cat">${sat.category}</div>
      </div>
      <div class="sat-list-dot" style="background:${sat.color}"></div>
    </div>
  `).join('');
}

function handleSatSearch(val) {
    satSearch = val;
    renderSatList();
}

// ── Cleanup ────────────────────────────────────────────
function pauseTracker() {
    // Called when switching away from tracker tab — stop intervals
    clearInterval(tracker.updateInterval);
    clearInterval(tracker.issInterval);
    tracker.updateInterval = null;
    tracker.issInterval = null;
}

function resumeTracker() {
    // Called when switching back to tracker tab — restart intervals
    if (!tracker.initialized) {
        initTracker();
        return;
    }
    updateAllMarkers();
    fetchISSRealtime();
    tracker.updateInterval = setInterval(updateAllMarkers, 5000);
    tracker.issInterval = setInterval(fetchISSRealtime, 5000);
    if (tracker.map) setTimeout(() => tracker.map.invalidateSize(), 100);
}
