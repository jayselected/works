/**
 * Portfolio Core Engine
 * Handles Geo-data, Hello Animation, and UI Interactions
 */

const CONFIG = {
    CACHE_DURATION: 3600000,
    WEATHER_API_KEY: 'd4fd2a9a46a63423027edc6d00dd9651',
    IPAPI_URL: 'https://ipapi.co/json/',
    WEATHER_API_URL: 'https://api.openweathermap.org/data/2.5/weather',
    LANGUAGES: [
        { text: 'Hello.' }, { text: 'Hola.' }, { text: 'Bonjour.' },
        { text: 'Hallo.' }, { text: 'Ciao.' }, { text: 'Olá.' },
        { text: 'Привет.' }, { text: '你好.' }, { text: 'こんにちは.' },
        { text: '안녕하세요.' }, { text: 'नमस्ते.' }, { text: 'مرحبا.' },
        { text: 'Hej.' }, { text: 'Merhaba.' }
    ]
};

let currentLanguageIndex = 0;

/* ============================================
   UI & SCROLL EFFECTS
   ============================================ */
function initScrollEffects() {
    const header = document.getElementById('site-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }, { passive: true });
}

/* ============================================
   HELLO ANIMATION
   ============================================ */
function runFadeSequence() {
    const el = document.getElementById('hello-text');
    if (!el) return;

    el.classList.remove('visible');

    setTimeout(() => {
        el.textContent = CONFIG.LANGUAGES[currentLanguageIndex].text;
        currentLanguageIndex = (currentLanguageIndex + 1) % CONFIG.LANGUAGES.length;
        el.classList.add('visible');
        setTimeout(runFadeSequence, 2400);
    }, 800);
}

function startHelloAnimation() {
    const el = document.getElementById('hello-text');
    if (!el) return;
    el.textContent = CONFIG.LANGUAGES[0].text;
    currentLanguageIndex = 1;
    setTimeout(() => {
        el.classList.add('visible');
        setTimeout(runFadeSequence, 2400);
    }, 300);
}

/* ============================================
   GEO-DATA & WEATHER
   ============================================ */
const CACHE_KEYS = {
    LOCATION: 'geo_location_cache',
    WEATHER: 'geo_weather_cache',
    TIMESTAMP: 'geo_cache_timestamp'
};

function getCachedData(key) {
    const timestamp = sessionStorage.getItem(CACHE_KEYS.TIMESTAMP);
    if (!timestamp || (Date.now() - parseInt(timestamp) > CONFIG.CACHE_DURATION)) return null;
    return JSON.parse(sessionStorage.getItem(key));
}

async function fetchGeoData() {
    try {
        let loc = getCachedData(CACHE_KEYS.LOCATION);
        if (!loc) {
            const res = await fetch(CONFIG.IPAPI_URL);
            loc = await res.json();
            sessionStorage.setItem(CACHE_KEYS.LOCATION, JSON.stringify(loc));
            sessionStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
        }

        let weather = getCachedData(CACHE_KEYS.WEATHER);
        if (!weather && loc.latitude) {
            const res = await fetch(`${CONFIG.WEATHER_API_URL}?lat=${loc.latitude}&lon=${loc.longitude}&appid=${CONFIG.WEATHER_API_KEY}&units=metric`);
            weather = await res.json();
            sessionStorage.setItem(CACHE_KEYS.WEATHER, JSON.stringify(weather));
        }

        updateGeoDisplay(loc, weather);
    } catch (e) {
        console.error("Geo load failed", e);
    }
}

function updateGeoDisplay(loc, weather) {
    const weatherEl = document.getElementById('location-weather-display');
    if (weatherEl && weather) {
        const temp = Math.round(weather.main.temp);
        const condition = weather.weather[0].main;
        weatherEl.innerHTML = `${loc.city}, ${loc.country_code} ${temp}° ${condition}`;
    }
}

function updateTime() {
    const timeEl = document.getElementById('datetime-display');
    const greetEl = document.getElementById('greeting-display');
    if (!timeEl) return;

    const now = new Date();
    const hours = now.getHours();
    
    let greet = "Good Night";
    if (hours >= 5 && hours < 12) greet = "Good Morning";
    else if (hours >= 12 && hours < 17) greet = "Good Afternoon";
    else if (hours >= 17 && hours < 22) greet = "Good Evening";

    greetEl.textContent = `${greet}.`;
    timeEl.textContent = now.toLocaleDateString('en-GB', { 
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
    }) + " " + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/* ============================================
   INITIALIZE
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    initScrollEffects();
    startHelloAnimation();
    fetchGeoData();
    updateTime();
    setInterval(updateTime, 60000); // Update time every minute
});
