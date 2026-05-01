/**
 * Portfolio Core Engine
 * Handled: Language Fade, Geo-Data, Weather Emojis, and Real-time Clock
 */

/* ============================================
   CONFIGURATION & DATA
   ============================================ */
const HELLO_LANGUAGES = [
    { text: 'Hello.' }, { text: 'Hola.' }, { text: 'Bonjour.' },
    { text: 'Hallo.' }, { text: 'Ciao.' }, { text: 'Olá.' },
    { text: 'Привет.' }, { text: '你好.' }, { text: 'こんにちは.' },
    { text: '안녕하세요.' }, { text: 'नमस्ते.' }, { text: 'مرحبا.' },
    { text: 'Hej.' }, { text: 'Merhaba.' }
];

const CONFIG = {
    CACHE_DURATION: 3600000,
    WEATHER_API_KEY: 'd4fd2a9a46a63423027edc6d00dd9651',
    IPAPI_URL: 'https://ipapi.co/json/',
    WEATHER_API_URL: 'https://api.openweathermap.org/data/2.5/weather'
};

const CACHE_KEYS = {
    LOCATION: 'geo_location_cache',
    WEATHER: 'geo_weather_cache',
    TIMESTAMP: 'geo_cache_timestamp'
};

let currentLanguageIndex = 0;

/* ============================================
   LANGUAGE FADE ANIMATION
   ============================================ */
function runFadeSequence() {
    const el = document.getElementById('hello-text');
    if (!el) return;

    el.classList.remove('visible');

    setTimeout(() => {
        el.textContent = HELLO_LANGUAGES[currentLanguageIndex].text;
        currentLanguageIndex = (currentLanguageIndex + 1) % HELLO_LANGUAGES.length;
        el.classList.add('visible');
        setTimeout(runFadeSequence, 2400);
    }, 800);
}

function startHelloAnimation() {
    const el = document.getElementById('hello-text');
    if (!el) return;

    el.textContent = HELLO_LANGUAGES[currentLanguageIndex].text;
    currentLanguageIndex = (currentLanguageIndex + 1) % HELLO_LANGUAGES.length;

    setTimeout(() => {
        el.classList.add('visible');
        setTimeout(runFadeSequence, 2400);
    }, 300);
}

/* ============================================
   GEO & WEATHER LOGIC (Full Emoji Mapping Preserved)
   ============================================ */
function isCacheValid() {
    const timestamp = sessionStorage.getItem(CACHE_KEYS.TIMESTAMP);
    return timestamp && (Date.now() - parseInt(timestamp, 10) < CONFIG.CACHE_DURATION);
}

function getCachedData(key) {
    try {
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
}

function setCachedData(key, data) {
    try {
        sessionStorage.setItem(key, JSON.stringify(data));
        sessionStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
    } catch (e) { console.warn('Cache error', e); }
}

function getWeatherDisplay(apiCondition) {
    const conditionMap = {
        'Clear':        { label: 'Sunny',        emoji: '☀️' },
        'Clouds':       { label: 'Cloudy',        emoji: '☁️' },
        'Rain':         { label: 'Rain',          emoji: '🌧️' },
        'Drizzle':      { label: 'Drizzle',       emoji: '🌦️' },
        'Thunderstorm': { label: 'Thunderstorm',  emoji: '⛈️' },
        'Snow':         { label: 'Snow',          emoji: '🌨️' },
        'Mist':         { label: 'Mist',          emoji: '🌫️' },
        'Fog':          { label: 'Fog',           emoji: '🌫️' },
        'Haze':         { label: 'Hazy',          emoji: '🌫️' },
        'Smoke':        { label: 'Smoke',         emoji: '🌫️' },
        'Dust':         { label: 'Dusty',         emoji: '🌫️' },
        'Sand':         { label: 'Sandstorm',     emoji: '🌫️' },
        'Ash':          { label: 'Volcanic Ash',  emoji: '🌫️' },
        'Squall':       { label: 'Windy',         emoji: '💨' },
        'Tornado':      { label: 'Tornado',       emoji: '🌪️' }
    };
    return conditionMap[apiCondition] || { label: apiCondition, emoji: '🌡️' };
}

async function updateGeoDisplay() {
    try {
        let location = isCacheValid() ? getCachedData(CACHE_KEYS.LOCATION) : null;
        if (!location) {
            const res = await fetch(CONFIG.IPAPI_URL);
            location = await res.json();
            setCachedData(CACHE_KEYS.LOCATION, location);
        }

        if (location?.latitude) {
            let weather = isCacheValid() ? getCachedData(CACHE_KEYS.WEATHER) : null;
            if (!weather) {
                const res = await fetch(`${CONFIG.WEATHER_API_URL}?lat=${location.latitude}&lon=${location.longitude}&appid=${CONFIG.WEATHER_API_KEY}&units=metric`);
                weather = await res.json();
                setCachedData(CACHE_KEYS.WEATHER, weather);
            }

            const { label, emoji } = getWeatherDisplay(weather.weather[0].main);
            const temp = Math.round(weather.main.temp * 10) / 10;
            const locationText = [location.city, location.country_name].filter(Boolean).join(', ');
            
            const el = document.getElementById('location-weather-display');
            if (el) el.innerHTML = `${locationText} ${temp}° ${label} ${emoji}`;
        }
    } catch (e) { console.error('Geo error', e); }
}

/* ============================================
   DATE & TIME LOGIC (1-Second Update Preserved)
   ============================================ */
function updateClock() {
    const timeEl = document.getElementById('datetime-display');
    const greetEl = document.getElementById('greeting-display');
    if (!timeEl || !greetEl) return;

    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dateStr = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}, ${now.getFullYear()}`;
    const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
    
    const hour = now.getHours();
    let greeting = 'Good Night';
    if (hour >= 5 && hour < 12) greeting = 'Good Morning';
    else if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
    else if (hour >= 17 && hour < 22) greeting = 'Good Evening';

    greetEl.innerHTML = `${greeting}.`;
    timeEl.innerHTML = `${dateStr} ${timeStr}`;
}

/* ============================================
   UI EFFECTS (Sticky Header Scroll)
   ============================================ */
function initHeaderEffect() {
    const header = document.getElementById('site-header');
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 0);
    }, { passive: true });
}

/* ============================================
   INITIALIZATION
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    startHelloAnimation();
    updateClock();
    updateGeoDisplay();
    initHeaderEffect();
    setInterval(updateClock, 1000);
});
