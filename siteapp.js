/**
 * Portfolio Geo Data Display
 * Vanilla JavaScript implementation with multi-language Hello TYPING animation
 */

// Multi-language Hello animations (Typing effect)
const HELLO_LANGUAGES = [
    { text: 'Hello.', lang: 'en' },
    { text: 'Hola.', lang: 'es' },
    { text: 'Bonjour.', lang: 'fr' },
    { text: 'Hallo.', lang: 'de' },
    { text: 'Ciao.', lang: 'it' },
    { text: 'Olá.', lang: 'pt' },
    { text: 'Привет.', lang: 'ru' },
    { text: '你好.', lang: 'zh' },
    { text: 'こんにちは.', lang: 'ja' },
    { text: '안녕하세요.', lang: 'ko' },
    { text: 'नमस्ते.', lang: 'hi' },
    { text: 'مرحبا.', lang: 'ar' },
    { text: 'Hej.', lang: 'sv' },
    { text: 'Hallo.', lang: 'nl' },
    { text: 'Merhaba.', lang: 'tr' }
];

let currentLanguageIndex = 0;
let typingTimeout = null;

function typeText(element, text, callback) {
    let charIndex = 0;
    element.textContent = '';
    element.style.opacity = '1';

    function typeChar() {
        if (charIndex < text.length) {
            element.textContent += text.charAt(charIndex);
            charIndex++;
            typingTimeout = setTimeout(typeChar, 80);
        } else {
            typingTimeout = setTimeout(() => {
                if (callback) callback();
            }, 2000);
        }
    }

    typeChar();
}

function clearText(element, callback) {
    const text = element.textContent;
    let charIndex = text.length;

    function clearChar() {
        if (charIndex > 0) {
            element.textContent = text.substring(0, charIndex - 1);
            charIndex--;
            typingTimeout = setTimeout(clearChar, 40);
        } else {
            if (callback) callback();
        }
    }

    clearChar();
}

function runTypingSequence() {
    const el = document.getElementById('hello-text');
    if (!el) return;

    el.lang = HELLO_LANGUAGES[currentLanguageIndex].lang;
    const text = HELLO_LANGUAGES[currentLanguageIndex].text;

    typeText(el, text, () => {
        clearText(el, () => {
            currentLanguageIndex = (currentLanguageIndex + 1) % HELLO_LANGUAGES.length;
            typingTimeout = setTimeout(runTypingSequence, 300);
        });
    });
}

function startHelloAnimation() {
    runTypingSequence();
}

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

async function fetchLocationData() {
    try {
        const response = await fetch(CONFIG.IPAPI_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setCachedData(CACHE_KEYS.LOCATION, data);
        return data;
    } catch (error) {
        console.error('Location fetch error:', error);
        const cached = getCachedData(CACHE_KEYS.LOCATION);
        if (cached) return cached;
        throw error;
    }
}

function getWeatherDisplay(apiCondition) {
    const conditionMap = {
        'Clear':        { label: 'Sunny',        emoji: '☀️'  },
        'Clouds':       { label: 'Cloudy',        emoji: '☁️'  },
        'Rain':         { label: 'Rain',          emoji: '🌧️'  },
        'Drizzle':      { label: 'Drizzle',       emoji: '🌦️'  },
        'Thunderstorm': { label: 'Thunderstorm',  emoji: '⛈️'  },
        'Snow':         { label: 'Snow',          emoji: '🌨️'  },
        'Mist':         { label: 'Mist',          emoji: '🌫️'  },
        'Fog':          { label: 'Fog',           emoji: '🌫️'  },
        'Haze':         { label: 'Hazy',          emoji: '🌫️'  },
        'Smoke':        { label: 'Smoke',         emoji: '🌫️'  },
        'Dust':         { label: 'Dusty',         emoji: '🌫️'  },
        'Sand':         { label: 'Sandstorm',     emoji: '🌫️'  },
        'Ash':          { label: 'Volcanic Ash',  emoji: '🌫️'  },
        'Squall':       { label: 'Windy',         emoji: '💨'  },
        'Tornado':      { label: 'Tornado',       emoji: '🌪️'  }
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
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}, ${now.getFullYear()}`;
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
        element.innerHTML = `${formatCurrentDate()}<br>${formatCurrentTime()}`;
    }
}

function updateGreeting() {
    const element = document.getElementById('greeting-display');
    if (element) {
        element.innerHTML = `${getGreeting()}.`;
    }
}

function showLoading() {
    const el = document.getElementById('location-weather-display');
    if (el) el.innerHTML = 'Loading...';
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

                const el = document.getElementById('location-weather-display');
                if (el) el.innerHTML = `${locationText} · ${temp}° ${label} ${emoji}`;

            } catch (weatherError) {
                console.error('Weather error:', weatherError);
                const locationText = [locationData.city, locationData.country_name]
                    .filter(Boolean)
                    .join(', ') || 'Unknown Location';
                const el = document.getElementById('location-weather-display');
                if (el) el.innerHTML = `${locationText} · Weather Unavailable`;
            }
        } else {
            showError('location-weather-display', 'Location Unavailable');
        }

    } catch (error) {
        console.error('Initialization error:', error);
        showError('location-weather-display', 'Location data unavailable');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGeoDisplay);
} else {
    initializeGeoDisplay();
}
