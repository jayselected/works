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
    { text: 'नमस्ते.', lang: 'hi' },             // Hindi
    { text: 'مرحبا.', lang: 'ar' },           // Arabic
    { text: 'Hej.', lang: 'sv' },             // Swedish
    { text: 'Hallo.', lang: 'nl' },           // Dutch
    { text: 'Merhaba.', lang: 'tr' }          // Turkish
];

let currentLanguageIndex = 0;

/**
 * Sequence per language (total ~4s per cycle):
 *
 *   0ms    — update text, reset gradient, fade in          (0.35s)
 *   2000ms — add chroma-sweep class → gradient sweeps      (0.85s + 0.1s delay = ~0.95s)
 *   3200ms — add hello-fade-out → text fades out           (0.35s)
 *   3600ms — remove all classes, advance language, restart
 */
function runHelloSequence() {
    const el = document.getElementById('hello-text');
    if (!el) return;

    // --- Step 1: Set new language text and reset gradient position ---
    el.textContent = HELLO_LANGUAGES[currentLanguageIndex].text;
    el.lang        = HELLO_LANGUAGES[currentLanguageIndex].lang;

    // Force gradient back to start position before animating in
    el.classList.remove('hello-fade-in', 'hello-fade-out', 'chroma-sweep');
    el.style.backgroundPosition = '100% 0, 100% 0';

    // Small delay to let the browser apply the reset before re-animating
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {

            // --- Step 2: Fade text in ---
            el.classList.add('hello-fade-in');

            // --- Step 3: Chroma sweep starts after text has been visible ---
            setTimeout(() => {
                el.classList.remove('hello-fade-in');
                el.style.opacity = '1'; // Keep visible while sweep plays
                el.classList.add('chroma-sweep');
            }, 2000);

            // --- Step 4: Fade text out after sweep completes ---
            setTimeout(() => {
                el.classList.remove('chroma-sweep');
                el.classList.add('hello-fade-out');
            }, 3200);

            // --- Step 5: Advance to next language and loop ---
            setTimeout(() => {
                el.classList.remove('hello-fade-out');
                el.style.opacity = '0';
                currentLanguageIndex = (currentLanguageIndex + 1) % HELLO_LANGUAGES.length;
                runHelloSequence();
            }, 3600);

        });
    });
}

/**
 * Start the Hello language cycling animation
 */
function startHelloAnimation() {
    runHelloSequence();
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
    
    const cacheAge = Date.now() - parseInt(timestamp, 10);
    return cacheAge < CONFIG.CACHE_DURATION;
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
        if (cached) {
            console.log('Using cached location data');
            return cached;
        }
        throw error;
    }
}

/**
 * Get weather emoji based on condition
 */
function getWeatherEmoji(condition) {
    const weatherMap = {
        'Clear': '☀️',
        'Cloudy': '☁️',
        'Rainy': '🌧️',
        'Drizzle': '🌦️',
        'Stormy': '⛈️',
        'Snowy': '❄️',
        'Foggy': '🌫️',
        'Mist': '🌫️',
        'Smoke': '🌫️',
        'Haze': '🌫️',
        'Dust': '🌫️',
        'Fog': '🌫️',
        'Sand': '🌫️',
        'Ash': '🌫️',
        'Squall': '💨',
        'Tornado': '🌪️'
    };
    
    return weatherMap[condition] || '🌡️';
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
        if (cached) {
            console.log('Using cached weather data');
            return cached;
        }
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
    
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    
    return `${dayName} ${day} ${monthName}, ${year}`;
}

/**
 * Get greeting based on current hour
 */
function getGreeting() {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
        return 'Good Morning';
    } else if (hour >= 12 && hour < 17) {
        return 'Good Afternoon';
    } else if (hour >= 17 && hour < 22) {
        return 'Good Evening';
    } else {
        return 'Good Night';
    }
}

/**
 * Format current time
 */
function formatCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Update date and time display
 */
function updateDateTime() {
    const element = document.getElementById('datetime-display');
    if (element) {
        const date = formatCurrentDate();
        const time = formatCurrentTime();
        element.innerHTML = `${date}<br>${time}`;
    }
}

/**
 * Update greeting display
 */
function updateGreeting() {
    const element = document.getElementById('greeting-display');
    if (element) {
        const greeting = getGreeting();
        element.innerHTML = `${greeting},<br>You're connecting from`;
    }
}

/**
 * Show loading state
 */
function showLoading() {
    const locationWeatherElement = document.getElementById('location-weather-display');
    if (locationWeatherElement) {
        locationWeatherElement.innerHTML = 'Loading location...';
    }
}

/**
 * Display error message
 */
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = message;
    }
}

/**
 * Main initialization function
 */
async function initializeGeoDisplay() {
    try {
        // Start the Hello animation
        startHelloAnimation();
        
        // Update date, time and greeting immediately
        updateDateTime();
        updateGreeting();
        
        // Show loading state
        showLoading();
        
        // Update every second
        setInterval(() => {
            updateDateTime();
            updateGreeting();
        }, 1000);
        
        // Check if we have valid cached data
        let locationData;
        
        if (isCacheValid()) {
            locationData = getCachedData(CACHE_KEYS.LOCATION);
            console.log('Using cached location data');
        }
        
        if (!locationData) {
            // Fetch fresh location data
            locationData = await fetchLocationData();
        }

        // Fetch and display weather if we have coordinates
        if (locationData && locationData.latitude && locationData.longitude) {
            try {
                let weatherData;
                
                if (isCacheValid()) {
                    weatherData = getCachedData(CACHE_KEYS.WEATHER);
                }
                
                if (!weatherData) {
                    weatherData = await fetchWeatherData(
                        locationData.latitude,
                        locationData.longitude
                    );
                }

                const temp = Math.round(weatherData.main.temp * 10) / 10; // Round to 1 decimal
                let condition = weatherData.weather[0].main;
                
                // Standardize to Apple's weather terminology
                if (condition === 'Clouds') condition = 'Cloudy';
                if (condition === 'Clear') condition = 'Clear';
                if (condition === 'Rain') condition = 'Rainy';
                if (condition === 'Drizzle') condition = 'Drizzle';
                if (condition === 'Thunderstorm') condition = 'Stormy';
                if (condition === 'Snow') condition = 'Snowy';
                if (condition === 'Mist' || condition === 'Fog' || condition === 'Haze') condition = 'Foggy';
                
                const emoji = getWeatherEmoji(condition);
                
                // Display location and weather together
                const locationWeatherElement = document.getElementById('location-weather-display');
                if (locationWeatherElement && locationData) {
                    const locationText = [locationData.city, locationData.country_name]
                        .filter(Boolean)
                        .join(', ') || 'Unknown Location';
                    locationWeatherElement.innerHTML = `${locationText}<br>Local Weather: ${temp}° ${condition} ${emoji}`;
                }
            } catch (weatherError) {
                console.error('Weather error:', weatherError);
                const locationWeatherElement = document.getElementById('location-weather-display');
                if (locationWeatherElement && locationData) {
                    const locationText = [locationData.city, locationData.country_name]
                        .filter(Boolean)
                        .join(', ') || 'Unknown Location';
                    locationWeatherElement.innerHTML = `${locationText}<br>Local Weather: Unavailable`;
                }
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
