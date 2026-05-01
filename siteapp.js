/**
 * Portfolio Core Engine
 * Restored with full Emoji Weather Mapping and 1-second Clock logic.
 */

const CONFIG = {
    CACHE_DURATION: 3600000,
    WEATHER_API_KEY: 'd4fd2a9a46a63423027edc6d00dd9651',
    IPAPI_URL: 'https://ipapi.co/json/',
    WEATHER_API_URL: 'https://api.openweathermap.org/data/2.5/weather',
    HELLO_LANGS: [
        { text: 'Hello.' }, { text: 'Hola.' }, { text: 'Bonjour.' },
        { text: 'Hallo.' }, { text: 'Ciao.' }, { text: 'Olá.' },
        { text: 'Привет.' }, { text: '你好.' }, { text: 'こんにちは.' },
        { text: '안녕하세요.' }, { text: 'नमस्ते.' }, { text: 'مرحبا.' },
        { text: 'Hej.' }, { text: 'Merhaba.' }
    ]
};

let currentLanguageIndex = 0;

/* ============================================
   HELLO ANIMATION
   ============================================ */
function runFadeSequence() {
    const el = document.getElementById('hello-text');
    if (!el) return;
    el.classList.remove('visible');
    setTimeout(() => {
        el.textContent = CONFIG.HELLO_LANGS[currentLanguageIndex].text;
        currentLanguageIndex = (currentLanguageIndex + 1) % CONFIG.HELLO_LANGS.length;
        el.classList.add('visible');
        setTimeout(runFadeSequence, 2400);
    }, 800);
}

function startHelloAnimation() {
    const el = document.getElementById('hello-text');
    if (!el) return;
    el.textContent = CONFIG.HELLO_LANGS[0].text;
    currentLanguageIndex = 1;
    setTimeout(() => {
        el.classList.add('visible');
        setTimeout(runFadeSequence, 2400);
    }, 300);
}

/* ============================================
   WEATHER & GEO DATA (Restored Emojis)
   ============================================ */
const CACHE_KEYS = {
    LOC: 'geo_location_cache',
    WEATH: 'geo_weather_cache',
    TIME: 'geo_cache_timestamp'
};

function getWeatherInfo(condition) {
    const map = {
        'Clear': { label: 'Sunny', emoji: '☀️' },
        'Clouds': { label: 'Cloudy', emoji: '☁️' },
        'Rain': { label: 'Rain', emoji: '🌧️' },
        'Drizzle': { label: 'Drizzle', emoji: '🌦️' },
        'Thunderstorm': { label: 'Thunderstorm', emoji: '⛈️' },
        'Snow': { label: 'Snow', emoji: '🌨️' },
        'Mist': { label: 'Mist', emoji: '🌫️' },
        'Fog': { label: 'Fog', emoji: '🌫️' },
        'Haze': { label: 'Hazy', emoji: '🌫️' }
    };
    return map[condition] || { label: condition, emoji: '🌡️' };
}

async function initGeo() {
    try {
        // Cache Logic
        const ts = sessionStorage.getItem(CACHE_KEYS.TIME);
        const isFresh = ts && (Date.now() - parseInt(ts) < CONFIG.CACHE_DURATION);
        
        let loc = isFresh ? JSON.parse(sessionStorage.getItem(CACHE_KEYS.LOC)) : null;
        if (!loc) {
            const res = await fetch(CONFIG.IPAPI_URL);
            loc = await res.json();
            sessionStorage.setItem(CACHE_KEYS.LOC, JSON.stringify(loc));
            sessionStorage.setItem(CACHE_KEYS.TIME, Date.now().toString());
        }

        let weath = isFresh ? JSON.parse(sessionStorage.getItem(CACHE_KEYS.WEATH)) : null;
        if (!weath && loc.latitude) {
            const res = await fetch(`${CONFIG.WEATHER_API_URL}?lat=${loc.latitude}&lon=${loc.longitude}&appid=${CONFIG.WEATHER_API_KEY}&units=metric`);
            weath = await res.json();
            sessionStorage.setItem(CACHE_KEYS.WEATH, JSON.stringify(weath));
        }

        if (weath) {
            const { label, emoji } = getWeatherInfo(weath.weather[0].main);
            const temp = Math.round(weath.main.temp);
            document.getElementById('location-weather-display').innerHTML = 
                `${loc.city}, ${loc.country_code} ${temp}° ${label} ${emoji}`;
        }
    } catch (e) { console.error("Geo Error", e); }
}

/* ============================================
   DATE & TIME (Restored 1s Update)
   ============================================ */
function updateClock() {
    const timeEl = document.getElementById('datetime-display');
    const greetEl = document.getElementById('greeting-display');
    if (!timeEl) return;

    const now = new Date();
    const hours = now.getHours();
    
    let greeting = "Good Night";
    if (hours >= 5 && hours < 12) greeting = "Good Morning";
    else if (hours >= 12 && hours < 17) greeting = "Good Afternoon";
    else if (hours >= 17 && hours < 22) greeting = "Good Evening";

    greetEl.textContent = `${greeting}.`;
    
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    timeEl.textContent = `${dateStr} ${timeStr}`;
}

/* ============================================
   SCROLL EFFECT
   ============================================ */
function initScroll() {
    const header = document.getElementById('site-header');
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 0);
    }, { passive: true });
}

/* ============================================
   BOOTSTRAP
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    startHelloAnimation();
    initGeo();
    initScroll();
    updateClock();
    setInterval(updateClock, 1000);
});
