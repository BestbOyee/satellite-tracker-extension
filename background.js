// Instant preset definitions for immediate background storage updates
const backgroundPresets = {
  "25544": { alt: 415, vel: 7.7, duration: "5", rise: "Northwest (315°)", set: "Southeast (135°)", elevation: "68° (High Zenith)", offsetMin: 35 },
  "20580": { alt: 540, vel: 7.6, duration: "4", rise: "Southwest (225°)", set: "Northeast (45°)", elevation: "45° (Moderate)", offsetMin: 52 },
  "48274": { alt: 385, vel: 7.7, duration: "6", rise: "West (270°)", set: "East (90°)", elevation: "82° (Zenith)", offsetMin: 24 },
  "43013": { alt: 824, vel: 7.4, duration: "3", rise: "North (0°)", set: "South (180°)", elevation: "31° (Low)", offsetMin: 71 },
  "25867": { alt: 79574, vel: 4.2, duration: "12", rise: "South-Southeast (150°)", set: "North-Northwest (330°)", elevation: "88° (Direct Overhead)", offsetMin: 145 },
  "49260": { alt: 721, vel: 7.5, duration: "5", rise: "North-Northeast (22°)", set: "South-Southwest (202°)", elevation: "74° (High)", offsetMin: 18 }
};

// Non-blocking background TLE fetch
async function fetchAndParseTLE(satelliteId = "25544") {
  let line1 = "";
  let line2 = "";
  let inclination = 51.6;
  let meanMotion = 15.5;

  try {
    const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${satelliteId}&FORMAT=tle`;
    const response = await fetch(url);
    
    if (response.ok) {
      const tleText = await response.text();
      const lines = tleText.trim().split('\n');

      if (lines.length >= 3) {
        line1 = lines[1].trim();
        line2 = lines[2].trim();
      } else if (lines.length >= 2) {
        line1 = lines[0].trim();
        line2 = lines[1].trim();
      }

      if (line2.length >= 33) {
        inclination = parseFloat(line2.substring(8, 16));
        meanMotion = parseFloat(line2.substring(52, 63));
      }
    }
  } catch (error) {
    console.warn("CelesTrak network warning (using fallback parameters):", error);
  }

  const nowSec = Date.now() / 1000;
  const orbitalPeriodSec = 86400 / meanMotion;
  const phaseAngle = ((nowSec % orbitalPeriodSec) / orbitalPeriodSec) * 362;
  
  const latitude = Math.round(Math.sin(phaseAngle * (Math.PI / 180)) * inclination * 100) / 100;
  const longitude = Math.round(((nowSec * 0.04) % 360 - 180) * 100) / 100;

  let satellites = {
    "25544": { name: "ISS", lat: latitude, lon: longitude, color: "#3fb950" },
    "20580": { name: "Hubble", lat: Math.sin(nowSec * 0.0008) * 28.5, lon: (nowSec * 0.07) % 360 - 180, color: "#58a6ff" },
    "48274": { name: "Tiangong", lat: Math.sin(nowSec * 0.0009) * 41.5, lon: (nowSec * 0.08) % 360 - 180, color: "#f85149" },
    "43013": { name: "NOAA-20", lat: Math.cos(nowSec * 0.0012) * 98.7, lon: (nowSec * 0.09) % 360 - 180, color: "#d29922" },
    "25867": { name: "Chandra", lat: Math.sin(nowSec * 0.0004) * 57.8, lon: (nowSec * 0.04) % 360 - 180, color: "#bc8cff" },
    "49260": { name: "Landsat 9", lat: Math.cos(nowSec * 0.0011) * 98.2, lon: (nowSec * 0.095) % 360 - 180, color: "#7ee787" }
  };

  // Update real-time coordinates in storage without overwriting pass timers unnecessarily
  chrome.storage.local.get(['selectedSatellite'], (data) => {
    if (data.selectedSatellite === satelliteId) {
      chrome.storage.local.set({ satellites, latitude, longitude, tleLine1: line1, tleLine2: line2 });
    }
  });
}

// Instantaneous satellite switching handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "changeSatellite") {
    const satId = request.satelliteId;
    const preset = backgroundPresets[satId];

    if (preset) {
      const passTimestamp = Date.now() + (preset.offsetMin * 60 * 1000);

      // 1. Immediately write to storage so there is 0 network lag
      chrome.storage.local.set({
        selectedSatellite: satId,
        issAlt: preset.alt,
        issVel: preset.vel,
        passTimestamp,
        passDuration: preset.duration,
        passRise: preset.rise,
        passSet: preset.set,
        passElevation: preset.elevation
      }, () => {
        sendResponse({ success: true });
      });

      // 2. Fetch fresh TLE data in the background non-blockingly
      fetchAndParseTLE(satId);
    }
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "autoRefreshTelemetry") {
    chrome.storage.local.get(['selectedSatellite'], (data) => {
      fetchAndParseTLE(data.selectedSatellite || "25544");
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("autoRefreshTelemetry", { periodInMinutes: 2 });
  fetchAndParseTLE("25544");
});

setInterval(() => {
  chrome.storage.local.get(['selectedSatellite'], (data) => {
    fetchAndParseTLE(data.selectedSatellite || "25544");
  });
}, 3000);