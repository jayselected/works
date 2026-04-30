/**
 * Portfolio Geo Data Display
 * Vanilla JavaScript implementation with multi-language Hello TYPING animation
 */

// Multi-language Hello animations (Typing effect)
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
    { text: 'नमस्ते.', lang: 'hi' },           // Hindi
    { text: 'مرحبا.', lang: 'ar' },           // Arabic
    { text: 'Hej.', lang: 'sv' },             // Swedish
    { text: 'Hallo.', lang: 'nl' },           // Dutch
    { text: 'Merhaba.', lang: 'tr' }          // Turkish
];

let currentLanguageIndex = 0;
let typingTimeout = null;

/**
 * Type out text character by character
 */
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

/**
 * Clear text character by character (backspace effect)
 */
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

/**
 * Run the typing sequence for Hello text
 */
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

/**
 * Start the Hello language typing animation
 */
function startHelloAnimation() {
    runTypingSequence();
}

// Configuration
const CONFIG = {
    CACHE_DURATION: 3600000, // 1 hour in milliseconds
    WEATHER_API_KEY: 'd4fd2a9a46a63423027edc6d00dd9651',
    IPAPI_URL: 'https://ipapi.co/json/',
    WEATHER_API_URL: 'https://api.openweathermap.org/data/2.5/weather'
};

// Cache keys for sessionStorage
const CACHE_KEYS = {
    LOCATION: 'geo_location_cache',
    WEATHER: 'geo_weather_cache',
    TIMESTAMP: 'geo_cache_timestamp'
};

/**
 * Check if cached data is still valid
 */
function isCacheValid() {
    const timestamp = sessionStorage.getItem(CACHE_KEYS.TIMESTAMP);
    if (!timestamp) return false;
    return Date.now() - parseInt(timestamp, 10) < CONFIG.CACHE_DURATION;
}

/**
 * Get cached data
 */
function getCachedData(key) {
    try {
        const data = sessionStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.warn('Cache read error:', e);
        return null;
    }
}

/**
 * Set cached data
 */
function setCachedData(key, data) {
    try {
        sessionStorage.setItem(key, JSON.stringify(data));
        sessionStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
    } catch (e) {
        console.warn('Cache write error:', e);
    }
}

/**
 * Fetch location data from ipapi.co
 */
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

/**
 * Map OpenWeatherMap condition codes to Apple/BBC Weather display labels and emojis
 */
function getWeatherDisplay(apiCondition) {
    const conditionMap = {
        'Clear':        { label: 'Sunny',           emoji: '☀️'  },
        'Clouds':       { label: 'Cloudy',           emoji: '☁️'  },
        'Rain':         { label: 'Rain',             emoji: '🌧️'  },
        'Drizzle':      { label: 'Drizzle',          emoji: '🌦️'  },
        'Thunderstorm': { label: 'Thunderstorm',     emoji: '⛈️'  },
        'Snow':         { label: 'Snow',             emoji: '🌨️'  },
        'Mist':         { label: 'Mist',             emoji: '🌫️'  },
        'Fog':          { label: 'Fog',              emoji: '🌫️'  },
        'Haze':         { label: 'Hazy',             emoji: '🌫️'  },
        'Smoke':        { label: 'Smoke',            emoji: '🌫️'  },
        'Dust':         { label: 'Dusty',            emoji: '🌫️'  },
        'Sand':         { label: 'Sandstorm',        emoji: '🌫️'  },
        'Ash':          { label: 'Volcanic Ash',     emoji: '🌫️'  },
        'Squall':       { label: 'Windy', emoji: '💨' },
        'Tornado':      { label: 'Tornado',          emoji: '🌪️'  }
    };

    return conditionMap[apiCondition] || { label: apiCondition, emoji: '🌡️' };
}

/**
 * Fetch weather data from OpenWeatherMap
 */
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

/**
 * Format current date
 */
function formatCurrentDate() {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}, ${now.getFullYear()}`;
}

/**
 * Get greeting based on current hour
 */
function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5  && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 22) return 'Good Evening';
    return 'Good Night';
}

/**
 * Format current time
 */
function formatCurrentTime() {
    const now = new Date();
    return [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map(n => String(n).padStart(2, '0'))
        .join(':');
}

/**
 * Update date and time display
 */
function updateDateTime() {
    const element = document.getElementById('datetime-display');
    if (element) {
        element.innerHTML = `${formatCurrentDate()}<br>${formatCurrentTime()}`;
    }
}

/**
 * Update greeting display
 */
function updateGreeting() {
    const element = document.getElementById('greeting-display');
    if (element) {
        element.innerHTML = `${getGreeting()},<br>You're connecting from`;
    }
}

/**
 * Show loading state
 */
function showLoading() {
    const el = document.getElementById('location-weather-display');
    if (el) el.innerHTML = 'Loading location...';
}

/**
 * Display error message
 */
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) element.innerHTML = message;
}

/**
 * Main initialization function
 */
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
                if (el) el.innerHTML = `${locationText}<br>${temp}° ${label} ${emoji}`;

            } catch (weatherError) {
                console.error('Weather error:', weatherError);
                const locationText = [locationData.city, locationData.country_name]
                    .filter(Boolean)
                    .join(', ') || 'Unknown Location';
                const el = document.getElementById('location-weather-display');
                if (el) el.innerHTML = `${locationText}<br>Weather Unavailable`;
            }
        } else {
            showError('location-weather-display', 'Location Unavailable<br>Weather Unavailable');
        }

    } catch (error) {
        console.error('Initialization error:', error);
        showError('location-weather-display', 'Location data unavailable');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGeoDisplay);
} else {
    initializeGeoDisplay();
}
