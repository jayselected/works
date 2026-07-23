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
        country_code: data.country_code || '',
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
        country_code: data.country_code || '',
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

/* One definition of "narrow" for every abbreviation decision, so the date
   and the location always shorten together. */
function isNarrowViewport() {
    return window.innerWidth < 768;
}

/* On narrow screens the country shows as a short code instead of its full
   name. The code comes from the geo provider (ISO 3166 alpha-2), so every
   country is covered automatically; this map only overrides the few whose
   everyday abbreviation differs from the ISO one. */
const COUNTRY_ABBREVIATIONS = {
    GB: 'UK',
    AE: 'UAE',
    KR: 'S. Korea',
    NL: 'Netherlands'
};

function formatCountry(location) {
    const fullName = location?.country_name || '';
    if (!isNarrowViewport()) return fullName;

    const code = (location?.country_code || '').toUpperCase();
    if (!code) return fullName;

    return COUNTRY_ABBREVIATIONS[code] || code;
}

/* The last resolved location, kept so the city line can be re-rendered when
   the viewport crosses the abbreviation breakpoint. */
let activeLocation = null;

function renderLocationText() {
    const cityEl = document.getElementById('location-city-display');
    if (cityEl && activeLocation) {
        cityEl.textContent = formatLocationText(activeLocation);
    }
}

function formatLocationText(location) {
    return [location?.city, formatCountry(location)]
        .filter(Boolean)
        .join(', ') || 'Unknown Location';
}

function formatCurrentDate() {
    const now = new Date();
    const daysFull  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthsFull  = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day   = isNarrowViewport() ? daysShort[now.getDay()] : daysFull[now.getDay()];
    const month = isNarrowViewport() ? monthsShort[now.getMonth()] : monthsFull[now.getMonth()];
    return `${day} ${now.getDate()} ${month}`;
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
        element.textContent = `${formatCurrentDate()} ${formatCurrentTime()}`;
    }
}

function showLoading() {
    const cityEl    = document.getElementById('location-city-display');
    const weatherEl = document.getElementById('location-weather-display');
    if (cityEl)    cityEl.textContent    = 'Loading...';
    if (weatherEl) weatherEl.textContent = '';
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = message;
}

async function initializeGeoDisplay() {
    try {
        startHelloAnimation();
        updateDateTime();
        showLoading();

        setInterval(updateDateTime, 1000);

        let locationData = isCacheValid() ? getCachedData(CACHE_KEYS.LOCATION) : null;
        if (!locationData) locationData = await fetchLocationData();

        if (locationData?.latitude && locationData?.longitude) {
            try {
                let weatherData = isCacheValid() ? getCachedData(CACHE_KEYS.WEATHER) : null;
                if (!weatherData) weatherData = await fetchWeatherData(locationData.latitude, locationData.longitude);

                const temp = Math.round(weatherData.main.temp * 10) / 10;
                const { label, emoji } = getWeatherDisplay(weatherData.weather[0].main);

                activeLocation = locationData;

                const weatherEl = document.getElementById('location-weather-display');
                renderLocationText();
                if (weatherEl) weatherEl.textContent = `${temp}° ${label} ${emoji}`;

            } catch (weatherError) {
                console.error('Weather error:', weatherError);
                activeLocation = locationData;

                const weatherEl = document.getElementById('location-weather-display');
                renderLocationText();
                if (weatherEl) weatherEl.textContent = 'Weather Unavailable';
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

/* ============================================
   Interface
   --------------------------------------------
   Everything below drives the chrome: theme, scroll progress, the project collapse, and
   back-to-top. All of it lives here rather than in index.html so behaviour
   has one home. The only exception is the theme bootstrap in the document
   head, which must run before first paint to avoid a flash.
   ============================================ */

/* Honours the OS "reduce motion" setting; read live so a change mid-session
   is respected without a reload. */
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* --------------------------------------------
   Theme
   -------------------------------------------- */

const THEME_STORAGE_KEY = 'portfolio-theme';

/* Must match --color-bg in styles.css so the browser's own chrome matches
   the page. */
const THEME_BACKGROUNDS = {
    light: '#FFFFFF',
    dark:  '#0E0E0E'
};

const THEME_ICONS = {
    light: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
    `,
    dark: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
    `
};

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.innerHTML = THEME_ICONS[theme];
        toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }

    const themeColor = document.getElementById('theme-color');
    if (themeColor) {
        themeColor.setAttribute('content', THEME_BACKGROUNDS[theme]);
    }

    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        // Private browsing or storage disabled: the theme still applies for
        // this session, it just will not be remembered.
    }
}

function initializeTheme() {
    const toggle = document.getElementById('theme-toggle');
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

    if (toggle) {
        toggle.addEventListener('click', () => {
            applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
        });
    }
}

/* --------------------------------------------
   Scroll progress
   -------------------------------------------- */

function initializeScroll() {
    const progress = document.getElementById('scroll-progress');
    const fill     = document.getElementById('scroll-progress-fill');
    let queued = false;

    function render() {
        queued = false;
        if (!progress || !fill) return;

        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = scrollable > 0
            ? Math.min(1, Math.max(0, window.scrollY / scrollable))
            : 0;

        fill.style.transform = `scaleX(${ratio})`;
        progress.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    }

    /* Scroll events can fire far more often than the screen refreshes;
       coalescing into one frame keeps this off the critical path. */
    function queueRender() {
        if (!queued) {
            queued = true;
            window.requestAnimationFrame(render);
        }
    }

    window.addEventListener('scroll', queueRender, { passive: true });
    window.addEventListener('resize', () => {
        queueRender();
        // Crossing the abbreviation breakpoint changes the location string;
        // the clock rewrites itself every second, the city does not.
        renderLocationText();
    }, { passive: true });

    if ('ResizeObserver' in window) {
        // The page changes height when images load or projects collapse;
        // the progress ratio must follow.
        new ResizeObserver(queueRender).observe(document.body);
    }

    render();
}

/* --------------------------------------------
   Project collapse
   -------------------------------------------- */

const COLLAPSE_ICONS = {
    collapse: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m14 10 7-7"></path>
            <path d="M20 10h-6V4"></path>
            <path d="m3 21 7-7"></path>
            <path d="M4 14h6v6"></path>
        </svg>
    `,
    expand: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 3h6v6"></path>
            <path d="m21 3-7 7"></path>
            <path d="m3 21 7-7"></path>
            <path d="M9 21H3v-6"></path>
        </svg>
    `
};

function initializeProjectCollapse() {
    const toggle = document.getElementById('project-collapse');
    if (!toggle) return;

    function setCollapsed(collapsed) {
        document.body.classList.toggle('projects-collapsed', collapsed);
        toggle.innerHTML = collapsed ? COLLAPSE_ICONS.expand : COLLAPSE_ICONS.collapse;
        toggle.setAttribute('aria-label', collapsed ? 'Expand projects' : 'Collapse projects');
        toggle.setAttribute('aria-pressed', String(collapsed));
    }

    setCollapsed(false);

    toggle.addEventListener('click', () => {
        setCollapsed(!document.body.classList.contains('projects-collapsed'));
    });
}

/* --------------------------------------------
   Back to top
   -------------------------------------------- */

function initializeScrollTop() {
    const button = document.getElementById('scroll-top');
    if (!button) return;

    button.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth'
        });
    });
}

/* ============================================
   Start
   ============================================ */

function start() {
    initializeTheme();
    initializeScroll();
    initializeProjectCollapse();
    initializeScrollTop();
    initializeGeoDisplay();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    start();
}
