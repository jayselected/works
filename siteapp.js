/**
 * Portfolio behaviour
 * -------------------
 * The hero (cycling greeting, live date, local conditions) and the chrome
 * (theme, scroll progress, project collapse, back to top, entrance motion).
 * The only script outside this file is the theme bootstrap in the document
 * head, which must run before first paint to avoid a flash of the wrong theme.
 */

/* ============================================
   Shared
   ============================================ */

/* Read live, so a change to the OS setting mid-session is respected. */
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* Reads a duration token from the stylesheet, so timings that must match the
   CSS are single-sourced rather than duplicated here. */
function cssDuration(name, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (raw.endsWith('ms')) return parseFloat(raw) || fallback;
    if (raw.endsWith('s'))  return (parseFloat(raw) || 0) * 1000 || fallback;
    return fallback;
}

function pad(value) {
    return String(value).padStart(2, '0');
}

/* ============================================
   Hero — cycling greeting
   ============================================ */

const HELLO_LANGUAGES = [
    'Hello.', 'Hola.', 'Bonjour.', 'Hallo.', 'Ciao.', 'Olá.', 'Привет.',
    '你好.', 'こんにちは.', '안녕하세요.', 'नमस्ते.', 'مرحبا.', 'Hej.', 'Merhaba.'
];

const HELLO_HOLD_MS = 2400;   /* how long each greeting is held */
const FIRST_FADE_MS = 300;    /* beat before the page speaks */

/* Set from --enter-ms at start: the swap waits for the fade-out to finish,
   so a mismatch would show the word changing. */
let fadeMs = 900;

let languageIndex = 0;

function nextGreeting(el) {
    el.textContent = HELLO_LANGUAGES[languageIndex];
    languageIndex = (languageIndex + 1) % HELLO_LANGUAGES.length;
}

function runFadeSequence() {
    const el = document.getElementById('hero-hello');
    if (!el) return;

    el.classList.remove('visible');

    setTimeout(() => {
        nextGreeting(el);
        el.classList.add('visible');
        setTimeout(runFadeSequence, HELLO_HOLD_MS);
    }, fadeMs);
}

function startHelloAnimation() {
    const el = document.getElementById('hero-hello');
    const name = document.querySelector('.hero-name');
    if (!el) return;

    nextGreeting(el);

    setTimeout(() => {
        el.classList.add('visible');
        /* The name arrives on the same beat, then stays while the languages
           keep cycling above it. */
        if (name) name.classList.add('visible');
        setTimeout(runFadeSequence, HELLO_HOLD_MS);
    }, FIRST_FADE_MS);
}

/* ============================================
   Hero — date and local conditions
   ============================================ */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
              'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

/* One clock and one lookup feed every subscriber — the hero lines and the
   top bar — so nothing is fetched or counted twice. */
function initializeHeroMeta() {
    const clocks = [...document.querySelectorAll('[data-clock]')];

    if (clocks.length) {
        clocks.forEach(el => el.classList.add('visible'));

        const tick = () => {
            const now = new Date();
            const text =
                DAYS[now.getDay()] + ', '
                + now.getDate() + ' ' + MONTHS[now.getMonth()] + ' '
                + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

            clocks.forEach(el => { el.textContent = text; });
            /* Wake on the next second boundary, so the seconds never stall
               or skip the way a plain interval can. */
            window.setTimeout(tick, 1000 - (Date.now() % 1000));
        };

        tick();
    }

    if (document.querySelector('[data-conditions], [data-place], [data-weather]')) {
        getConditions()
            .then(conditions => {
                const where = [conditions.city, conditions.country].filter(Boolean).join(', ');
                const what  = (conditions.label + ' ' + conditions.temperature + '\u00b0').trim();

                /* Published three ways from one lookup: the hero shows them
                   as a sentence, the bar as separate fields. */
                fill('[data-place]', where);
                fill('[data-weather]', what);
                fill('[data-conditions]', where ? where + '. ' + what : what);
            })
            /* On failure the lines are removed, so the hero closes up cleanly
               rather than holding a blank. */
            .catch(() => {
                document.querySelectorAll('[data-conditions], [data-place], [data-weather]')
                    .forEach(el => { el.hidden = true; });
            });
    }
}

function fill(selector, text) {
    document.querySelectorAll(selector).forEach(el => {
        el.textContent = text;
        el.classList.add('visible');
    });
}

/* --------------------------------------------
   Top bar
   -------------------------------------------- */

function initializeTopBar() {
    const topbar = document.getElementById('topbar');
    const anchor = document.querySelector('.hero-meta');
    if (!topbar || !anchor || !('IntersectionObserver' in window)) return;

    /* Shown once the hero's own date and conditions have passed behind the
       bar, so the two never say the same thing at the same time. The bar is
       measured rather than assumed, so its height lives in the CSS alone. */
    new IntersectionObserver(([entry]) => {
        const passed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        topbar.classList.toggle('is-visible', passed);
    }, {
        rootMargin: `-${topbar.offsetHeight}px 0px 0px 0px`,
        threshold: 0
    }).observe(anchor);
}

/* ============================================
   Location and weather

   IP geolocation (two providers, second as fallback) plus Open-Meteo, which
   needs no API key — nothing secret lives in this file.
   ============================================ */

const WEATHER_CACHE_KEY = 'site-conditions-v3';
const WEATHER_CACHE_MS = 30 * 60 * 1000;

/* WMO weather codes, grouped the way a person would describe them. */
const CONDITIONS = {
    0: 'Clear',            1: 'Mainly Clear',     2: 'Partly Cloudy',
    3: 'Overcast',        45: 'Fog',             48: 'Rime Fog',
    51: 'Light Drizzle',  53: 'Drizzle',         55: 'Heavy Drizzle',
    56: 'Freezing Drizzle', 57: 'Freezing Drizzle',
    61: 'Light Rain',     63: 'Rain',            65: 'Heavy Rain',
    66: 'Freezing Rain',  67: 'Freezing Rain',
    71: 'Light Snow',     73: 'Snow',            75: 'Heavy Snow',
    77: 'Snow Grains',    80: 'Showers',         81: 'Showers',
    82: 'Heavy Showers',  85: 'Snow Showers',    86: 'Snow Showers',
    95: 'Thunderstorm',   96: 'Thunderstorm',    99: 'Thunderstorm'
};

function readCachedWeather() {
    try {
        const raw = sessionStorage.getItem(WEATHER_CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        return Date.now() - cached.at < WEATHER_CACHE_MS ? cached : null;
    } catch (error) {
        return null;
    }
}

function writeCachedWeather(payload) {
    try {
        sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
        /* Private browsing: it still works, it just refetches. */
    }
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
}

async function resolveLocation() {
    try {
        const data = await fetchJson('https://ipwho.is/');
        if (data && data.success !== false && Number.isFinite(data.latitude)) {
            return {
                city: data.city || '',
                country: data.country || '',
                latitude: data.latitude,
                longitude: data.longitude
            };
        }
    } catch (error) {
        /* fall through to the second provider */
    }

    const data = await fetchJson('https://ipapi.co/json/');
    if (!data || data.error || !Number.isFinite(data.latitude)) throw new Error('no location');
    return {
        city: data.city || '',
        country: data.country_name || '',
        latitude: data.latitude,
        longitude: data.longitude
    };
}

/* Deduplicated in flight and cached for half an hour, so the page never asks
   twice. Resolves to { city, country, temperature, label }. */
let conditionsPromise = null;

function getConditions() {
    if (conditionsPromise) return conditionsPromise;

    const cached = readCachedWeather();
    if (cached) {
        conditionsPromise = Promise.resolve(cached);
        return conditionsPromise;
    }

    conditionsPromise = (async () => {
        const place = await resolveLocation();

        const weather = await fetchJson(
            'https://api.open-meteo.com/v1/forecast'
            + '?latitude=' + place.latitude
            + '&longitude=' + place.longitude
            + '&current=temperature_2m,weather_code,is_day'
        );

        const code = weather.current.weather_code;
        /* A clear sky reads as "Sunny" only while the sun is up. */
        const label = code === 0
            ? (weather.current.is_day ? 'Sunny' : 'Clear')
            : (CONDITIONS[code] || '');

        const payload = {
            city: place.city,
            country: place.country,
            temperature: Math.round(weather.current.temperature_2m),
            label,
            at: Date.now()
        };
        writeCachedWeather(payload);
        return payload;
    })();

    /* A failed lookup must not poison the session: clear the memo so a later
       consumer can retry. Consumers handle their own rejection. */
    conditionsPromise.catch(() => { conditionsPromise = null; });

    return conditionsPromise;
}

/* ============================================
   Theme
   ============================================ */

const THEME_STORAGE_KEY = 'portfolio-theme';

/* Must match --color-bg, so the browser's own chrome matches the page. */
const THEME_BACKGROUNDS = { light: '#FFFFFF', dark: '#000000' };

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
        toggle.dataset.label = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
        dockLabel.refresh(toggle);
    }

    const themeColor = document.getElementById('theme-color');
    if (themeColor) themeColor.setAttribute('content', THEME_BACKGROUNDS[theme]);

    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        /* Storage disabled: the theme holds for this session, unremembered. */
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

/* ============================================
   Scroll progress
   ============================================ */

function initializeScroll() {
    const progress = document.getElementById('scroll-progress');
    const bar      = document.getElementById('scroll-progress-fill');
    if (!progress || !bar) return;

    let queued = false;

    function render() {
        queued = false;

        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = scrollable > 0
            ? Math.min(1, Math.max(0, window.scrollY / scrollable))
            : 0;

        bar.style.transform = `scaleX(${ratio})`;
        progress.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    }

    /* Scroll fires far more often than the screen refreshes; coalescing into
       one frame keeps this off the critical path. */
    function queueRender() {
        if (!queued) {
            queued = true;
            window.requestAnimationFrame(render);
        }
    }

    window.addEventListener('scroll', queueRender, { passive: true });
    window.addEventListener('resize', queueRender, { passive: true });

    /* The page changes height when images load or projects collapse. */
    if ('ResizeObserver' in window) {
        new ResizeObserver(queueRender).observe(document.body);
    }

    render();
}

/* ============================================
   Dock labels

   Names whichever control is under the pointer, like the macOS dock. Three
   ways in: mouse hover, keyboard focus, and — on touch — a long press that
   can be dragged across the dock to read each control in turn.
   ============================================ */

const LONG_PRESS_MS = 250;

const dockLabel = (() => {
    let dock = null;
    let label = null;
    let active = null;          // the control currently named
    let pressTimer = null;
    let longPressed = false;    // suppresses the click that would follow

    function controlFrom(node) {
        return node && node.closest ? node.closest('[data-label]') : null;
    }

    function place(control) {
        const dockBox = dock.getBoundingClientRect();
        const box = control.getBoundingClientRect();
        const half = label.offsetWidth / 2;

        // Centre on the control, then keep the label inside the dock so it
        // never runs off screen at either end.
        const centre = box.left + box.width / 2 - dockBox.left;
        label.style.left = Math.max(half, Math.min(dockBox.width - half, centre)) + 'px';
    }

    function show(control) {
        if (!control || !control.dataset.label) return;
        active = control;
        label.textContent = control.dataset.label;
        place(control);                       // measure and position first
        label.classList.add('is-visible');    // then reveal, so it never slides in from the wrong place
    }

    function hide() {
        active = null;
        if (label) label.classList.remove('is-visible');
    }

    /* Called when a control's label changes while it may be on screen. */
    function refresh(control) {
        if (label && active === control && control.dataset.label) {
            label.textContent = control.dataset.label;
            place(control);
        }
    }

    function init() {
        dock = document.querySelector('.dock');
        label = document.getElementById('dock-label');
        if (!dock || !label) return;

        /* Mouse only; touch is handled below, and letting both run would
           flash the label on every tap. */
        dock.addEventListener('pointerover', event => {
            if (event.pointerType !== 'mouse') return;
            const control = controlFrom(event.target);
            if (control) show(control);
        });

        dock.addEventListener('pointerout', event => {
            if (event.pointerType !== 'mouse') return;
            const control = controlFrom(event.target);
            // Ignore moves between a control and its own child SVG.
            if (control && !control.contains(event.relatedTarget)) hide();
        });

        dock.addEventListener('focusin', event => show(controlFrom(event.target)));
        dock.addEventListener('focusout', hide);

        /* Touch: long press, then slide between controls. */
        dock.addEventListener('touchstart', event => {
            const control = controlFrom(event.target);
            if (!control) return;

            longPressed = false;
            window.clearTimeout(pressTimer);
            pressTimer = window.setTimeout(() => {
                longPressed = true;
                show(control);
            }, LONG_PRESS_MS);
        }, { passive: true });

        dock.addEventListener('touchmove', event => {
            if (!longPressed) {
                // Moving before the press registers means a scroll, not a hold.
                window.clearTimeout(pressTimer);
                return;
            }

            event.preventDefault();   // hold the page still while reading

            const touch = event.touches[0];
            const control = controlFrom(document.elementFromPoint(touch.clientX, touch.clientY));

            if (control && control !== active) show(control);
            else if (!control) hide();
        }, { passive: false });

        function endTouch() {
            window.clearTimeout(pressTimer);
            if (longPressed) hide();
        }

        dock.addEventListener('touchend', endTouch);
        dock.addEventListener('touchcancel', endTouch);

        /* A long press is a read, not a tap — swallow the click it would
           otherwise produce, so holding Email doesn't open mail. */
        dock.addEventListener('click', event => {
            if (longPressed) {
                event.preventDefault();
                event.stopPropagation();
                longPressed = false;
            }
        }, true);

        // Anything that moves the dock invalidates the label's position.
        window.addEventListener('resize', () => { if (active) place(active); }, { passive: true });
        window.addEventListener('scroll', () => { if (active) place(active); }, { passive: true });
    }

    return { init, refresh };
})();

/* ============================================
   Project collapse

   Reduces every project to its title, type, and lead image, laid out as a
   grid by the CSS. Collapsing is a layout change and so cannot be
   transitioned directly; where the browser supports view transitions the
   swap runs inside one and is interpolated instead.
   ============================================ */

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
    const works = document.querySelector('.works');
    if (!toggle || !works) return;

    const projects = [...works.querySelectorAll('.project')];
    let collapsed = false;

    /* A unique name per project lets the browser move each one individually
       between the two layouts; without them the whole block cross-fades.
       Indexed rather than hard-coded, so adding a project needs nothing. */
    projects.forEach((project, index) => {
        project.style.viewTransitionName = 'project-' + (index + 1);
    });

    function paint() {
        document.body.classList.toggle('projects-collapsed', collapsed);

        toggle.innerHTML = collapsed ? COLLAPSE_ICONS.expand : COLLAPSE_ICONS.collapse;
        toggle.setAttribute('aria-label', collapsed ? 'Expand projects' : 'Collapse projects');
        toggle.setAttribute('aria-pressed', String(collapsed));
        toggle.dataset.label = collapsed ? 'Expand Projects' : 'Collapse Projects';
        dockLabel.refresh(toggle);

        projects.forEach(project => {
            if (!collapsed) {
                project.removeAttribute('role');
                project.removeAttribute('tabindex');
                project.removeAttribute('aria-label');
                return;
            }

            /* Collapsed, the whole card is the control that expands the view
               again — by keyboard as well as pointer. The title goes in the
               label so the card still says which project it is. */
            const title = project.querySelector('h2');
            project.setAttribute('role', 'button');
            project.setAttribute('tabindex', '0');
            project.setAttribute('aria-label',
                (title ? title.textContent.trim() + ', ' : '') + 'expand projects');

            /* Nothing should still be mid-entrance when the grid forms. */
            project.querySelectorAll('[data-enter]').forEach(el => el.classList.add('is-in'));
        });
    }

    function setCollapsed(next) {
        if (next === collapsed) return;
        collapsed = next;

        if (prefersReducedMotion() || typeof document.startViewTransition !== 'function') {
            paint();
            return;
        }

        /* Fixed chrome is named only for the length of the morph. Holding a
           view-transition name permanently makes an element a backdrop root,
           which stops the frosted glass inside it from sampling the page. */
        const chrome = ['.topbar', '.dock']
            .map(selector => document.querySelector(selector))
            .filter(Boolean);

        chrome.forEach((el, index) => { el.style.viewTransitionName = 'chrome-' + index; });
        const release = () => chrome.forEach(el => { el.style.viewTransitionName = ''; });

        /* then(release, release): a skipped transition rejects, and the name
           must come off either way. */
        document.startViewTransition(paint).finished.then(release, release);
    }

    paint();

    toggle.addEventListener('click', () => setCollapsed(!collapsed));

    works.addEventListener('click', () => {
        if (collapsed) setCollapsed(false);
    });

    works.addEventListener('keydown', event => {
        if (!collapsed) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setCollapsed(false);
        }
    });
}

/* ============================================
   Entrance motion

   Content marked [data-enter] fades and rises in as it enters the viewport.
   Inert under prefers-reduced-motion — the CSS neutralises it and this skips
   its work.
   ============================================ */

function initializeEntrance() {
    const items = [...document.querySelectorAll('[data-enter]')];
    if (!items.length) return;

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
        items.forEach(el => el.classList.add('is-in'));
        return;
    }

    const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);   // reveal once, then stop watching
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    /* On screen at load reveals immediately; anything below the fold waits,
       so each later project fades in as it is reached. */
    const viewportBottom = window.innerHeight;
    items.forEach(el => {
        const box = el.getBoundingClientRect();
        if (box.top < viewportBottom && box.bottom > 0) el.classList.add('is-in');
        else io.observe(el);
    });
}

/* ============================================
   Back to top
   ============================================ */

function initializeScrollTop() {
    const button = document.getElementById('scroll-top');
    if (!button) return;

    button.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
}

/* ============================================
   Start
   ============================================ */

let started = false;

function start() {
    if (started) return;   // never bind twice, however this file is loaded
    started = true;

    fadeMs = cssDuration('--enter-ms', fadeMs);

    /* Each module is isolated: one failing must not take the rest with it.
       dockLabel goes first — the theme and collapse modules refresh it. */
    [
        () => dockLabel.init(),
        startHelloAnimation,
        initializeHeroMeta,
        initializeTheme,
        initializeScroll,
        initializeTopBar,
        initializeProjectCollapse,
        initializeScrollTop,
        initializeEntrance
    ].forEach(run => {
        try {
            run();
        } catch (error) {
            console.error('[site] module failed:', error);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    start();
}
