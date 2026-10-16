let countdownInterval;
let rotationOffset = 0;
let pitchOffset = 0;
let zoomLevel = 1;
let isDragging = false;
let startX = 0;
let startY = 0;

// Default fallback location (New York) until geolocation resolves
let userLocation = { lat: 40.71, lon: -74.00 };

// Bulletproof orbital presets supporting both IDs and names
const satellitePresets = {
  "25544": { id: "25544", alt: 415, vel: 7.7, duration: "5", rise: "Northwest (315°)", set: "Southeast (135°)", elevation: "68° (High Zenith)", offsetMin: 35 },
  "ISS": { id: "25544", alt: 415, vel: 7.7, duration: "5", rise: "Northwest (315°)", set: "Southeast (135°)", elevation: "68° (High Zenith)", offsetMin: 35 },
  
  "20580": { id: "20580", alt: 540, vel: 7.6, duration: "4", rise: "Southwest (225°)", set: "Northeast (45°)", elevation: "45° (Moderate)", offsetMin: 52 },
  "Hubble": { id: "20580", alt: 540, vel: 7.6, duration: "4", rise: "Southwest (225°)", set: "Northeast (45°)", elevation: "45° (Moderate)", offsetMin: 52 },
  
  "48274": { id: "48274", alt: 385, vel: 7.7, duration: "6", rise: "West (270°)", set: "East (90°)", elevation: "82° (Zenith)", offsetMin: 24 },
  "Tiangong": { id: "48274", alt: 385, vel: 7.7, duration: "6", rise: "West (270°)", set: "East (90°)", elevation: "82° (Zenith)", offsetMin: 24 },
  
  "43013": { id: "43013", alt: 824, vel: 7.4, duration: "3", rise: "North (0°)", set: "South (180°)", elevation: "31° (Low)", offsetMin: 71 },
  "NOAA-20": { id: "43013", alt: 824, vel: 7.4, duration: "3", rise: "North (0°)", set: "South (180°)", elevation: "31° (Low)", offsetMin: 71 },
  
  "25867": { id: "25867", alt: 79574, vel: 4.2, duration: "12", rise: "South-Southeast (150°)", set: "North-Northwest (330°)", elevation: "88° (Direct Overhead)", offsetMin: 145 },
  "Chandra": { id: "25867", alt: 79574, vel: 4.2, duration: "12", rise: "South-Southeast (150°)", set: "North-Northwest (330°)", elevation: "88° (Direct Overhead)", offsetMin: 145 },
  
  "49260": { id: "49260", alt: 721, vel: 7.5, duration: "5", rise: "North-Northeast (22°)", set: "South-Southwest (202°)", elevation: "74° (High)", offsetMin: 18 },
  "Landsat 9": { id: "49260", alt: 721, vel: 7.5, duration: "5", rise: "North-Northeast (22°)", set: "South-Southwest (202°)", elevation: "74° (High)", offsetMin: 18 }
};

function initGlobe() {
  const canvas = document.getElementById('globeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;

  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const globeRadius = (Math.min(width, height) / 2.2) * zoomLevel;

  // 1. Realistic Blue Atmospheric Outer Glow
  const atmosGrad = ctx.createRadialGradient(centerX, centerY, globeRadius * 0.8, centerX, centerY, globeRadius * 1.3);
  atmosGrad.addColorStop(0, 'rgba(56, 139, 253, 0.4)');
  atmosGrad.addColorStop(0.7, 'rgba(31, 111, 235, 0.15)');
  atmosGrad.addColorStop(1, 'rgba(13, 17, 23, 0)');

  ctx.fillStyle = atmosGrad;
  ctx.beginPath();
  ctx.arc(centerX, centerY, globeRadius * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // 2. Solid Deep Blue Earth Sphere
  const earthGrad = ctx.createRadialGradient(centerX - 30, centerY - 30, 20, centerX, centerY, globeRadius);
  earthGrad.addColorStop(0, '#388bfd');  
  earthGrad.addColorStop(0.6, '#1f6feb'); 
  earthGrad.addColorStop(1, '#091d3a');   

  ctx.fillStyle = earthGrad;
  ctx.beginPath();
  ctx.arc(centerX, centerY, globeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#58a6ff';
  ctx.stroke();

  // Clip rendering strictly inside the globe
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, globeRadius, 0, Math.PI * 2);
  ctx.clip();

  // 3. Latitude & Longitude Grid Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;

  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath();
    let started = false;
    for (let lon = -180; lon <= 180; lon += 10) {
      let coords = projectLatLonTo3D(lat, lon, centerX, centerY, globeRadius, rotationOffset, pitchOffset);
      if (coords.visible) {
        if (!started) { ctx.moveTo(coords.x, coords.y); started = true; }
        else { ctx.lineTo(coords.x, coords.y); }
      } else { started = false; }
    }
    ctx.stroke();
  }

  // Equator Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  let eqStarted = false;
  for (let lon = -180; lon <= 180; lon += 5) {
    let coords = projectLatLonTo3D(0, lon, centerX, centerY, globeRadius, rotationOffset, pitchOffset);
    if (coords.visible) {
      if (!eqStarted) { ctx.moveTo(coords.x, coords.y); eqStarted = true; }
      else { ctx.lineTo(coords.x, coords.y); }
    } else { eqStarted = false; }
  }
  ctx.stroke();

  // Unified Satellite Definitions (Guarantees 100% math sync between trails and live icons)
  const satellites = [
    { name: "ISS", color: "#3fb950", lat: t => Math.sin(t * 0.001) * 51.6, lon: t => (t * 0.12) % 360 - 180 },
    { name: "Hubble", color: "#58a6ff", lat: t => Math.sin(t * 0.0008) * 28.5, lon: t => (t * 0.10) % 360 - 180 },
    { name: "Tiangong", color: "#f85149", lat: t => Math.sin(t * 0.0009) * 41.5, lon: t => (t * 0.11) % 360 - 180 },
    { name: "NOAA-20", color: "#d29922", lat: t => Math.cos(t * 0.0012) * 98.7, lon: t => (t * 0.09) % 360 - 180 },
    { name: "Chandra", color: "#bc8cff", lat: t => Math.sin(t * 0.0004) * 57.8, lon: t => (t * 0.05) % 360 - 180 },
    { name: "Landsat 9", color: "#7ee787", lat: t => Math.cos(t * 0.0011) * 98.2, lon: t => (t * 0.095) % 360 - 180 }
  ];

  const nowSec = Date.now() / 1000;

  // 4. ORBITAL GROUND TRACK POLYLINES (Perfectly Synced)
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 6;

  satellites.forEach(sat => {
    ctx.strokeStyle = sat.color;
    ctx.shadowColor = sat.color;
    
    let prevCoords = null;
    let prevLon = null;

    for (let tOffset = -120; tOffset <= 0; tOffset += 2) {
      let t = nowSec + tOffset;
      let lat = sat.lat(t);
      let lon = sat.lon(t);

      let pCoords = projectLatLonTo3D(lat, lon, centerX, centerY, globeRadius, rotationOffset, pitchOffset);
      
      if (pCoords.visible) {
        let screenJump = prevCoords && (Math.abs(pCoords.x - prevCoords.x) > globeRadius || Math.abs(pCoords.y - prevCoords.y) > globeRadius);
        let lonJump = prevLon !== null && Math.abs(lon - prevLon) > 40;

        if (!prevCoords || screenJump || lonJump) {
          ctx.beginPath();
          ctx.moveTo(pCoords.x, pCoords.y);
        } else {
          ctx.lineTo(pCoords.x, pCoords.y);
          ctx.stroke();
        }
        prevCoords = pCoords;
        prevLon = lon;
      } else {
        prevCoords = null;
        prevLon = null;
      }
    }
  });
  ctx.shadowBlur = 0;

  // 5. Plot User Location Red Dot
  const userCoords = projectLatLonTo3D(userLocation.lat, userLocation.lon, centerX, centerY, globeRadius, rotationOffset, pitchOffset);
  if (userCoords.visible) {
    ctx.shadowColor = '#f85149';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#f85149';
    ctx.beginPath();
    ctx.arc(userCoords.x, userCoords.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#f0f6fc';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('📍 You', userCoords.x + 8, userCoords.y + 3);
  }

  // 6. Plot Live Satellites (Using the exact same shared formulas!)
  satellites.forEach(sat => {
    let lat = sat.lat(nowSec);
    let lon = sat.lon(nowSec);
    const satCoords = projectLatLonTo3D(lat, lon, centerX, centerY, globeRadius, rotationOffset, pitchOffset);
    
    if (satCoords.visible) {
      ctx.shadowColor = sat.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = sat.color;
      ctx.beginPath();
      ctx.arc(satCoords.x, satCoords.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = sat.color;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`🛰️ ${sat.name}`, satCoords.x + 8, satCoords.y - 4);
    }
  });

  ctx.restore();
}
// Calculate Sun's sub-solar latitude and longitude based on current UTC time
function getSunCoordinates() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
  
  // Approximate solar declination angle (tilt of the Earth relative to the sun)
  const declination = -23.45 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  
  // Sub-solar longitude based on UTC hours, minutes, and seconds
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds / 3600;
  const sunLon = -15 * (utcHours - 12); // 15 degrees per hour, 0 at noon UTC
  
  return { lat: declination, lon: normalizeLon(sunLon) };
}

function normalizeLon(lon) {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}
// Robust 3D Matrix Projection Engine
function projectLatLonTo3D(lat, lon, cx, cy, radius, rotOffset, pitch) {
  let phi = (lat * Math.PI) / 180;
  let totalLonRad = ((lon + rotOffset) * Math.PI) / 180;
  
  let x1 = Math.cos(phi) * Math.sin(totalLonRad);
  let y1 = Math.sin(phi);
  let z1 = Math.cos(phi) * Math.cos(totalLonRad);

  let pitchRad = (pitch * Math.PI) / 180;
  let x2 = x1;
  let y2 = y1 * Math.cos(pitchRad) - z1 * Math.sin(pitchRad);
  let z2 = y1 * Math.sin(pitchRad) + z1 * Math.cos(pitchRad);

  let visible = z2 > 0;
  let x = cx + x2 * radius;
  let y = cy - y2 * radius;

  return { x, y, visible };
}

let selectElement;

document.addEventListener('DOMContentLoaded', () => {
  
  const canvas = document.getElementById('globeCanvas');
  selectElement = document.getElementById('satellite-select');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation.lat = Math.round(position.coords.latitude * 100) / 100;
        userLocation.lon = Math.round(position.coords.longitude * 100) / 100;
        initGlobe();
      },
      (error) => {
        console.warn("Geolocation permission denied or unavailable. Using default coordinates.", error);
      }
    );
  }
  chrome.storage.local.get(['customNewTabEnabled'], (data) => {
    if (data.customNewTabEnabled === false) {
      window.location.href = "https://www.google.com";
      return;
    }
  });
  // --- STANDARD TAB TOGGLE FEATURE ---
const toggleBtn = document.getElementById('toggle-tab-mode');

// Check saved state on load
chrome.storage.local.get(['customNewTabEnabled'], (data) => {
  const isEnabled = data.customNewTabEnabled !== false; // defaults to true
  updateTabModeUI(isEnabled);
});

toggleBtn.addEventListener('click', () => {
  chrome.storage.local.get(['customNewTabEnabled'], (data) => {
    const currentState = data.customNewTabEnabled !== false;
    const newState = !currentState;
    chrome.storage.local.set({ customNewTabEnabled: newState }, () => {
      updateTabModeUI(newState);
    });
  });
});

function updateTabModeUI(isEnabled) {
  const container = document.querySelector('.mission-container');
  let overlay = document.getElementById('standardModeOverlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'standardModeOverlay';
    overlay.className = 'standard-mode-overlay';
    overlay.innerHTML = `
      <div style="font-size: 24px; font-weight: bold; color: #58a6ff;">Standard New Tab Mode</div>
      <p style="color: #8b949e; max-width: 400px; font-size: 14px;">Orbital Mission Control is currently bypassed. You can resume your mission dashboard at any time.</p>
      <button id="restore-mission-btn" style="background-color: #238636; color: #ffffff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;">Resume Mission Control</button>
      <a href="https://www.google.com" style="color: #58a6ff; font-size: 13px; text-decoration: none; margin-top: 8px;">Open Google Search ↗</a>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById('restore-mission-btn').addEventListener('click', () => {
      chrome.storage.local.set({ customNewTabEnabled: true }, () => {
        updateTabModeUI(true);
      });
    });
  }

  if (isEnabled) {
    container.style.display = 'grid';
    overlay.classList.remove('active');
    toggleBtn.textContent = 'Standard Tab Mode';
  } else {
    container.style.display = 'none';
    overlay.classList.add('active');
    toggleBtn.textContent = 'Resume Mission Control';
  }
}
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    startX = e.clientX;
    startY = e.clientY;

    rotationOffset += deltaX * 0.5;
    pitchOffset = Math.max(-60, Math.min(60, pitchOffset - deltaY * 0.4));
    
    initGlobe();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Expanded Zoom range (0.4x to 3.0x)
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomLevel = Math.min(zoomLevel + 0.15, 3.0);
    } else {
      zoomLevel = Math.max(zoomLevel - 0.15, 0.4);
    }
    initGlobe();
  }, { passive: false });

  window.addEventListener('resize', () => {
    initGlobe();
  });

  chrome.storage.local.get(['selectedSatellite', 'passTimestamp', 'passDuration', 'passRise', 'passSet', 'passElevation', 'issAlt', 'issVel'], (data) => {
    updateUI(data);
    initGlobe();
  });

  // INSTANT DROP_DOWN SWITCHING WITH PRESETS & RACE-CONDITION PREVENTION
  selectElement.addEventListener('change', (event) => {
    const rawSelection = event.target.value;
    const preset = satellitePresets[rawSelection];

    if (preset) {
      const targetId = preset.id;

      // 1. Instant UI update
      document.getElementById('iss-alt').textContent = preset.alt + ' km';
      document.getElementById('iss-vel').textContent = preset.vel + ' km/s';
      document.getElementById('pass-rise').textContent = preset.rise;
      document.getElementById('pass-set').textContent = preset.set;
      document.getElementById('pass-elevation').textContent = preset.elevation;
      document.getElementById('pass-duration').textContent = preset.duration + ' min';
      document.getElementById('conn-status').textContent = 'Synced Live';

      const instantPassTimestamp = Date.now() + (preset.offsetMin * 60 * 1000);
      startCountdown(instantPassTimestamp, preset.duration);

      // 2. Immediately update storage and background worker without race conditions
      chrome.storage.local.set({ selectedSatellite: targetId }, () => {
        chrome.runtime.sendMessage({ action: "changeSatellite", satelliteId: targetId });
      });
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      chrome.storage.local.get(['selectedSatellite', 'passTimestamp', 'passDuration', 'passRise', 'passSet', 'passElevation', 'issAlt', 'issVel'], (data) => {
        updateUI(data);
      });
    }
  });

  // Smooth 60fps-style animation loop updating canvas every 50ms
  setInterval(() => {
    initGlobe();
  }, 50);
});

function updateUI(data) {
  if (data.issAlt) document.getElementById('iss-alt').textContent = data.issAlt + ' km';
  if (data.issVel) document.getElementById('iss-vel').textContent = data.issVel + ' km/s';
  if (data.passRise) document.getElementById('pass-rise').textContent = data.passRise;
  if (data.passSet) document.getElementById('pass-set').textContent = data.passSet;
  if (data.passElevation) document.getElementById('pass-elevation').textContent = data.passElevation;
  if (data.passDuration) document.getElementById('pass-duration').textContent = data.passDuration + ' min';

  // Only update dropdown value if the user is NOT currently focused on it
  if (selectElement && data.selectedSatellite && document.activeElement !== selectElement) {
    selectElement.value = data.selectedSatellite;
  }

  if (data.passTimestamp && data.passDuration) {
    startCountdown(data.passTimestamp, data.passDuration);
  }
}

function startCountdown(targetTimestamp, durationMinutes = 5) {
  if (countdownInterval) clearInterval(countdownInterval);

  function updateTimer() {
    const now = new Date().getTime();
    const distance = targetTimestamp - now;
    const passDurationMs = parseInt(durationMinutes || 5) * 60 * 1000;

    if (distance <= 0 && Math.abs(distance) <= passDurationMs) {
      document.getElementById('timer-hours').textContent = "00";
      document.getElementById('timer-minutes').textContent = "00";
      document.getElementById('timer-seconds').textContent = "00";
      document.getElementById('conn-status').textContent = "🛰️ PASS IN PROGRESS!";
      return;
    }

    if (distance < 0 && Math.abs(distance) > passDurationMs) {
      document.getElementById('timer-hours').textContent = "00";
      document.getElementById('timer-minutes').textContent = "00";
      document.getElementById('timer-seconds').textContent = "00";
      document.getElementById('conn-status').textContent = "Syncing Next Pass...";
      return;
    }

    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    document.getElementById('timer-hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('timer-minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('timer-seconds').textContent = String(seconds).padStart(2, '0');
    document.getElementById('conn-status').textContent = "Synced Live";
  }

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}