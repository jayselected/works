/**
 * Portfolio Geo Data Display
 * Vanilla JavaScript implementation with multi-language Hello FADE animation
 */

const HELLO_LANGUAGES = [
    { text: 'Hello.' },
    { text: 'Hola.' },
    { text: 'Bonjour.' },
    { text: 'Hallo.' },
    { text: 'Ciao.' },
    { text: 'Olá.' },
    { text: 'Привет.' },
    { text: '你好.' },
    { text: 'こんにちは.' },
    { text: '안녕하세요.' },
    { text: 'नमस्ते.' },
    { text: 'مرحبا.' },
    { text: 'Hej.' },
    { text: 'Merhaba.' }
];

let currentLanguageIndex = 0;

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

const CONFIG = {
    CACHE_DURATION: 3600000,
    WEATHER_API_KEY: 'd4fd2a9a46a63423027edc6d00dd9651',
    IPWHOIS_URL: 'https://ipwho.is/',
    IPAPI_URL: 'https://ipapi.co/json/',
    WEATHER_API_URL: 'https://api.openweathermap.org/data/2.5/weather'
};

const CACHE_KEYS = {
    LOCATION: 'geo_location_cache_v2',
    WEATHER: 'geo_weather_cache_v2',
    TIMESTAMP: 'geo_cache_timestamp_v2'
};

function isCacheValid() {
    const timestamp = sessionStorage.getItem(CACHE_KEYS.TIMESTAMP);
    if (!timestamp) return false;
    return Date.now() - parseInt(timestamp, 10) < CONFIG.CACHE_DURATION;
}

function getCachedData(key) {
    try {
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.warn('Cache read error:', e);
        return null;
    }
}

function setCachedData(key, data) {
    try {
        sessionStorage.setItem(key, JSON.stringify(data));
        sessionStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
    } catch (e) {
        console.warn('Cache write error:', e);
    }
}

function hasValidCoordinates(data) {
    return Number.isFinite(data?.latitude) && Number.isFinite(data?.longitude);
}

function normalizeIpwhoisData(data) {
    if (!data || data.success === false) return null;

    const locationData = {
        city: data.city || '',
        country_name: data.country || '',
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        source: 'ipwho.is'
    };

    return hasValidCoordinates(locationData) ? locationData : null;
}

function normalizeIpapiData(data) {
    if (!data || data.error) return null;

    const locationData = {
        city: data.city || '',
        country_name: data.country_name || '',
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        source: 'ipapi.co'
    };

    return hasValidCoordinates(locationData) ? locationData : null;
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

async function fetchLocationData() {
    try {
        const providers = [
            {
                url: CONFIG.IPWHOIS_URL,
                normalize: normalizeIpwhoisData
            },
            {
                url: CONFIG.IPAPI_URL,
                normalize: normalizeIpapiData
            }
        ];

        for (const provider of providers) {
            try {
                const data = await fetchJson(provider.url);
                const locationData = provider.normalize(data);

                if (locationData) {
                    setCachedData(CACHE_KEYS.LOCATION, locationData);
                    return locationData;
                }
            } catch (providerError) {
                console.warn('Location provider error:', providerError);
            }
        }

        throw new Error('No valid location provider response');
    } catch (error) {
        console.error('Location fetch error:', error);
        const cached = getCachedData(CACHE_KEYS.LOCATION);
        if (cached) return cached;
        throw error;
    }
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

async function fetchWeatherData(lat, lon) {
    try {
        const url = `${CONFIG.WEATHER_API_URL}?lat=${lat}&lon=${lon}&appid=${CONFIG.WEATHER_API_KEY}&units=metric`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setCachedData(CACHE_KEYS.WEATHER, data);
        return data;
    } catch (error) {
        console.error('Weather fetch error:', error);
        const cached = getCachedData(CACHE_KEYS.WEATHER);
        if (cached) return cached;
        throw error;
    }
}

function formatCurrentDate() {
    const now = new Date();
    const daysFull  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months    = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const isMobile  = window.innerWidth < 768;
    const day       = isMobile ? daysShort[now.getDay()] : daysFull[now.getDay()];
    return `${day} ${now.getDate()} ${months[now.getMonth()]}`;
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5  && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 22) return 'Good Evening';
    return 'Good Night';
}

function formatCurrentTime() {
    const now = new Date();
    return [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map(n => String(n).padStart(2, '0'))
        .join(':');
}

function updateDateTime() {
    const element = document.getElementById('datetime-display');
    if (element) {
        element.innerHTML = `${formatCurrentDate()} ${formatCurrentTime()}`;
    }
}

function updateGreeting() {
    const element = document.getElementById('greeting-display');
    // data-hold is set by the wordmark cycle in index.html while
    // "Jayselected." is on screen; the live greeting resumes when cleared.
    if (element && element.dataset.hold !== 'true') {
        element.innerHTML = `${getGreeting()}.`;
    }
}

function showLoading() {
    const cityEl    = document.getElementById('location-city-display');
    const weatherEl = document.getElementById('location-weather-display');
    if (cityEl)    cityEl.innerHTML    = 'Loading...';
    if (weatherEl) weatherEl.innerHTML = '';
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) element.innerHTML = message;
}

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

        let locationData = isCacheValid() ? getCachedData(CACHE_KEYS.LOCATION) : null;
        if (!locationData) locationData = await fetchLocationData();

        if (locationData?.latitude && locationData?.longitude) {
            try {
                let weatherData = isCacheValid() ? getCachedData(CACHE_KEYS.WEATHER) : null;
                if (!weatherData) weatherData = await fetchWeatherData(locationData.latitude, locationData.longitude);

                const temp = Math.round(weatherData.main.temp * 10) / 10;
                const { label, emoji } = getWeatherDisplay(weatherData.weather[0].main);

                const locationText = [locationData.city, locationData.country_name]
                    .filter(Boolean)
                    .join(', ') || 'Unknown Location';

                const cityEl    = document.getElementById('location-city-display');
                const weatherEl = document.getElementById('location-weather-display');
                if (cityEl)    cityEl.innerHTML    = locationText;
                if (weatherEl) weatherEl.innerHTML = `${temp}° ${label} ${emoji}`;

            } catch (weatherError) {
                console.error('Weather error:', weatherError);
                const locationText = [locationData.city, locationData.country_name]
                    .filter(Boolean)
                    .join(', ') || 'Unknown Location';
                const cityEl    = document.getElementById('location-city-display');
                const weatherEl = document.getElementById('location-weather-display');
                if (cityEl)    cityEl.innerHTML    = locationText;
                if (weatherEl) weatherEl.innerHTML = 'Weather Unavailable';
            }
        } else {
            showError('location-city-display',    'Location Unavailable');
            showError('location-weather-display', '');
        }

    } catch (error) {
        console.error('Initialization error:', error);
        showError('location-city-display',    'Location data unavailable');
        showError('location-weather-display', '');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGeoDisplay);
} else {
    initializeGeoDisplay();
}
