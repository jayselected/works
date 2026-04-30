/**
 * Portfolio Geo Data Display
 * Vanilla JavaScript implementation with multi-language Hello animation
 */

// Multi-language Hello animations (Apple-style)
const HELLO_LANGUAGES = [
    { text: 'Hello.', lang: 'en' },           // English
    { text: 'Hola.', lang: 'es' },            // Spanish  
    { text: 'Bonjour.', lang: 'fr' },         // French
    { text: 'Hallo.', lang: 'de' },           // German
    { text: 'Ciao.', lang: 'it' },            // Italian
    { text: 'Olá.', lang: 'pt' },             // Portuguese
    { text: 'Привет.', lang: 'ru' },          // Russian
    { text: '你好.', lang: 'zh' },             // Mandarin Chinese
    { text: 'こんにちは.', lang: 'ja' },        // Japanese
    { text: '안녕하세요.', lang: 'ko' },         // Korean
    { text: 'नमस्ते.', lang: 'hi' },          // Hindi
    { text: 'مرحبا.', lang: 'ar' },           // Arabic
    { text: 'Hej.', lang: 'sv' },             // Swedish
    { text: 'Hallo.', lang: 'nl' },           // Dutch
    { text: 'Merhaba.', lang: 'tr' }          // Turkish
];

let currentLanguageIndex = 0;

/**
 * Sequence per language (total ~4s per cycle)
 */
function runHelloSequence() {
    const el = document.getElementById('hello-text');
    if (!el) return;

    el.textContent = HELLO_LANGUAGES[currentLanguageIndex].text;
    el.lang = HELLO_LANGUAGES[currentLanguageIndex].lang;

    el.classList.remove('hello-fade-in', 'hello-fade-out', 'chroma-sweep');
    el.style.backgroundPosition = '100% 0, 100% 0';

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {

            el.classList.add('hello-fade-in');

            setTimeout(() => {
                el.classList.remove('hello-fade-in');
                el.style.opacity = '1';
                el.classList.add('chroma-sweep');
            }, 1000);

            setTimeout(() => {
                el.classList.remove('chroma-sweep');
                el.classList.add('hello-fade-out');
            }, 3200);

            setTimeout(() => {
                el.classList.remove('hello-fade-out');
                el.style.opacity = '0';
                currentLanguageIndex = (currentLanguageIndex + 1) % HELLO_LANGUAGES.length;
                runHelloSequence();
            }, 3600);

        });
    });
}

function startHelloAnimation() {
    runHelloSequence();
}

// Configuration
const CONFIG = {
    CACHE_DURATION: 3600000,
    WEATHER_API_KEY: 'd4fd2a9a46a63423027edc6d00dd9651',
    IPAPI_URL: 'https://ipapi.co/json/',
    WEATHER_API_URL: 'https://api.openweathermap.org/data/2.5/weather'
};

// Cache keys
const CACHE_KEYS = {
    LOCATION: 'geo_location_cache',
    WEATHER: 'geo_weather_cache',
    TIMESTAMP: 'geo_cache_timestamp'
};

function isCacheValid() {
    const timestamp = sessionStorage.getItem(CACHE_KEYS.TIMESTAMP);
    if (!timestamp) return false;
    return (Date.now() - parseInt(timestamp, 10)) < CONFIG.CACHE_DURATION;
}

function getCachedData(key) {
    try {
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

function setCachedData(key, data) {
    try {
        sessionStorage.setItem(key, JSON.stringify(data));
        sessionStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
    } catch {}
}

async function fetchLocationData() {
    try {
        const res = await fetch(CONFIG.IPAPI_URL);
        const data = await res.json();
        setCachedData(CACHE_KEYS.LOCATION, data);
        return data;
    } catch {
        return getCachedData(CACHE_KEYS.LOCATION);
    }
}

async function fetchWeatherData(lat, lon) {
    try {
        const url = `${CONFIG.WEATHER_API_URL}?lat=${lat}&lon=${lon}&appid=${CONFIG.WEATHER_API_KEY}&units=metric`;
        const res = await fetch(url);
        const data = await res.json();
        setCachedData(CACHE_KEYS.WEATHER, data);
        return data;
    } catch {
        return getCachedData(CACHE_KEYS.WEATHER);
    }
}

// Date / Time
function formatCurrentDate() {
    const now = new Date();
    return now.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function formatCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-GB');
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    if (h < 22) return 'Good Evening';
    return 'Good Night';
}

function updateDateTime() {
    const el = document.getElementById('datetime-display');
    if (el) {
        el.innerHTML = `${formatCurrentDate()}<br>${formatCurrentTime()}`;
    }
}

/**
 * UPDATED: Greeting (clean, no UI language)
 */
function updateGreeting() {
    const el = document.getElementById('greeting-display');
    if (el) {
        el.innerHTML = `${getGreeting()}.`;
    }
}

function showLoading() {
    const el = document.getElementById('location-weather-display');
    if (el) el.innerHTML = 'Loading…';
}

function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = msg;
}

// Main
async function initializeGeoDisplay() {
    try {
        startHelloAnimation();

        updateDateTime();
        updateGreeting();

        showLoading();

        setInterval(() => {
            updateDateTime();
            updateGreeting();
        }, 1000);

        let location = isCacheValid() ? getCachedData(CACHE_KEYS.LOCATION) : null;
        if (!location) location = await fetchLocationData();

        if (location?.latitude && location?.longitude) {
            let weather = isCacheValid() ? getCachedData(CACHE_KEYS.WEATHER) : null;
            if (!weather) {
                weather = await fetchWeatherData(location.latitude, location.longitude);
            }

            let condition = weather.weather[0].main;
            if (condition === 'Clouds') condition = 'Cloudy';
            if (condition === 'Rain') condition = 'Rainy';
            if (condition === 'Thunderstorm') condition = 'Stormy';

            const temp = Math.round(weather.main.temp);

            const el = document.getElementById('location-weather-display');
            if (el) {
                const place = [location.city, location.country_name].filter(Boolean).join(', ');
                el.innerHTML = `${place}<br>${temp}° ${condition}`;
            }

        } else {
            showError('location-weather-display', 'Location unavailable');
        }

    } catch {
        showError('location-weather-display', 'Data unavailable');
    }
}

// Init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGeoDisplay);
} else {
    initializeGeoDisplay();
}
