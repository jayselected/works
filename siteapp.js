/**
 * Portfolio behaviour
 * -------------------
 * Two things live here: the multi-language "Hello" fade in the hero, and
 * the chrome (theme, scroll progress, project collapse, back to top).
 * The only script outside this file is the theme bootstrap in the document
 * head, which must run before first paint to avoid a flash of the wrong
 * theme.
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

/* ============================================
   Interface
   --------------------------------------------
   Everything below drives the chrome: theme, scroll progress, the project collapse,
   back-to-top, the flip-clock widget, and the entrance/parallax motion. All of it lives here rather than in index.html so behaviour
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
    light: '#FCFBF9',
    dark:  '#000000'
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
        toggle.dataset.label = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
        dockLabel.refresh(toggle);
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
    window.addEventListener('resize', queueRender, { passive: true });

    if ('ResizeObserver' in window) {
        // The page changes height when images load or projects collapse;
        // the progress ratio must follow.
        new ResizeObserver(queueRender).observe(document.body);
    }

    render();
}

/* --------------------------------------------
   Widget — flip clock, date, conditions

   The clock is a real split-flap: each digit is two half-height windows
   onto one glyph, and a change drops a card carrying the old digit while
   a second card carrying the new one rises to meet it.

   Weather comes from Open-Meteo, which needs no API key — so nothing
   secret lives in this file.
   -------------------------------------------- */

const FLIP_MS = 320;              /* keep in step with --flip-ms in the CSS */
const WEATHER_CACHE_KEY = 'widget_conditions_v1';
const WEATHER_CACHE_MS = 30 * 60 * 1000;

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* WMO weather codes, grouped the way a person would describe them. */
const CONDITIONS = {
    0:  ['Clear', '\u2600\ufe0f'],        1:  ['Mainly Clear', '\ud83c\udf24\ufe0f'],
    2:  ['Partly Cloudy', '\u26c5'],       3:  ['Overcast', '\u2601\ufe0f'],
    45: ['Fog', '\ud83c\udf2b\ufe0f'],   48: ['Rime Fog', '\ud83c\udf2b\ufe0f'],
    51: ['Light Drizzle', '\ud83c\udf26\ufe0f'], 53: ['Drizzle', '\ud83c\udf26\ufe0f'],
    55: ['Heavy Drizzle', '\ud83c\udf26\ufe0f'], 56: ['Freezing Drizzle', '\ud83c\udf27\ufe0f'],
    57: ['Freezing Drizzle', '\ud83c\udf27\ufe0f'], 61: ['Light Rain', '\ud83c\udf26\ufe0f'],
    63: ['Rain', '\ud83c\udf27\ufe0f'],  65: ['Heavy Rain', '\ud83c\udf27\ufe0f'],
    66: ['Freezing Rain', '\ud83c\udf27\ufe0f'], 67: ['Freezing Rain', '\ud83c\udf27\ufe0f'],
    71: ['Light Snow', '\ud83c\udf28\ufe0f'], 73: ['Snow', '\ud83c\udf28\ufe0f'],
    75: ['Heavy Snow', '\u2744\ufe0f'],   77: ['Snow Grains', '\ud83c\udf28\ufe0f'],
    80: ['Showers', '\ud83c\udf26\ufe0f'], 81: ['Showers', '\ud83c\udf27\ufe0f'],
    82: ['Heavy Showers', '\ud83c\udf27\ufe0f'], 85: ['Snow Showers', '\ud83c\udf28\ufe0f'],
    86: ['Snow Showers', '\ud83c\udf28\ufe0f'], 95: ['Thunderstorm', '\u26c8\ufe0f'],
    96: ['Thunderstorm', '\u26c8\ufe0f'], 99: ['Thunderstorm', '\u26c8\ufe0f']
};

function pad(value) {
    return String(value).padStart(2, '0');
}

/* ---- Flaps ---- */

function buildFlap(digit) {
    const flap = document.createElement('div');
    flap.className = 'flap';
    flap.dataset.value = digit;
    flap.innerHTML =
        '<div class="flap-half flap-upper"><span>' + digit + '</span></div>' +
        '<div class="flap-half flap-lower"><span>' + digit + '</span></div>' +
        '<div class="flap-half flap-fold-upper"><span></span></div>' +
        '<div class="flap-half flap-fold-lower"><span></span></div>';
    return flap;
}

function buildPair(container, value) {
    container.textContent = '';
    [...value].forEach(digit => container.appendChild(buildFlap(digit)));
}

function setFlap(flap, next) {
    const current = flap.dataset.value;
    if (current === next) return;

    flap.dataset.value = next;
    flap.querySelector('.flap-upper span').textContent = next;
    flap.querySelector('.flap-fold-upper span').textContent = current;
    flap.querySelector('.flap-fold-lower span').textContent = next;

    flap.classList.remove('is-flipping');
    void flap.offsetWidth;                  /* forces the animation to restart */
    flap.classList.add('is-flipping');

    window.setTimeout(() => {
        flap.querySelector('.flap-lower span').textContent = next;
        flap.classList.remove('is-flipping');
    }, FLIP_MS);
}

function setPair(container, value) {
    const flaps = container.children;
    [...value].forEach((digit, i) => {
        if (flaps[i]) setFlap(flaps[i], digit);
    });
}

/* ---- Weather ---- */

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
        /* Private browsing: the widget still works, it just refetches. */
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
            return { city: data.city || '', latitude: data.latitude, longitude: data.longitude };
        }
    } catch (error) {
        /* fall through to the second provider */
    }

    const data = await fetchJson('https://ipapi.co/json/');
    if (!data || data.error || !Number.isFinite(data.latitude)) throw new Error('no location');
    return { city: data.city || '', latitude: data.latitude, longitude: data.longitude };
}

async function loadConditions() {
    const placeEl = document.getElementById('widget-place');
    const tempEl = document.getElementById('widget-temp');
    if (!placeEl || !tempEl) return;

    const cached = readCachedWeather();
    if (cached) {
        placeEl.textContent = cached.city;
        tempEl.textContent = cached.summary;
        return;
    }

    try {
        const place = await resolveLocation();
        placeEl.textContent = place.city;

        const weather = await fetchJson(
            'https://api.open-meteo.com/v1/forecast'
            + '?latitude=' + place.latitude
            + '&longitude=' + place.longitude
            + '&current=temperature_2m,weather_code'
        );

        const temperature = Math.round(weather.current.temperature_2m);
        const [label, emoji] = CONDITIONS[weather.current.weather_code] || ['', ''];
        const summary = temperature + '\u00b0 ' + emoji + ' ' + label;

        tempEl.textContent = summary;
        writeCachedWeather({ city: place.city, summary, at: Date.now() });
    } catch (error) {
        placeEl.textContent = 'Conditions unavailable';
        tempEl.textContent = '';
    }
}

/* ---- Assembly ---- */

function initializeWidget() {
    const widget = document.querySelector('.widget');
    const hours = document.getElementById('widget-hours');
    const minutes = document.getElementById('widget-minutes');
    const dateEl = document.getElementById('widget-date');
    const timeEl = document.getElementById('widget-time');
    if (!widget || !hours || !minutes) return;

    function render(first) {
        const now = new Date();
        const hh = pad(now.getHours());
        const mm = pad(now.getMinutes());

        if (first) {
            buildPair(hours, hh);
            buildPair(minutes, mm);
        } else {
            setPair(hours, hh);
            setPair(minutes, mm);
        }

        const date = DAYS[now.getDay()] + ' ' + now.getDate() + ' ' + MONTHS[now.getMonth()];
        if (dateEl) dateEl.textContent = date;
        if (timeEl) timeEl.textContent = date + ', ' + hh + ':' + mm;
    }

    render(true);
    window.setInterval(() => render(false), 1000);

    /* Publishes the widget's real height so the page can clear it below
       1000px. Measured rather than assumed, so changing its padding or
       type never needs a matching constant updated by hand. */
    function measure() {
        const height = Math.round(widget.getBoundingClientRect().height);
        if (height) {
            document.documentElement.style.setProperty('--widget-height', height + 'px');
        }
    }

    measure();
    if ('ResizeObserver' in window) {
        new ResizeObserver(measure).observe(widget);
    }

    loadConditions();
}

/* --------------------------------------------
   Dock labels

   Names whichever control is under the pointer, like the macOS dock.
   Three ways in: mouse hover, keyboard focus, and — on touch — a long
   press that can be dragged across the dock to read each control in
   turn, the way iOS keyboard key previews work.
   -------------------------------------------- */

const LONG_PRESS_MS = 250;

const dockLabel = (() => {
    let dock = null;
    let label = null;
    let active = null;          // the control currently being named
    let pressTimer = null;
    let longPressed = false;    // suppresses the click that would follow

    function controlFrom(node) {
        return node && node.closest ? node.closest('[data-label]') : null;
    }

    function place(control) {
        const dockBox = dock.getBoundingClientRect();
        const box = control.getBoundingClientRect();
        const half = label.offsetWidth / 2;

        // Centre on the control, then keep the whole label inside the dock
        // so it never runs off screen at the far left or right.
        const centre = box.left + box.width / 2 - dockBox.left;
        const clamped = Math.max(half, Math.min(dockBox.width - half, centre));

        label.style.left = clamped + 'px';
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
        label.classList.remove('is-visible');
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

        /* ---- Pointer: mouse only. Touch is handled below, and letting
                both run would flash the label on every tap. ---- */
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

        /* ---- Keyboard ---- */
        dock.addEventListener('focusin', event => show(controlFrom(event.target)));
        dock.addEventListener('focusout', hide);

        /* ---- Touch: long press, then slide between controls ---- */
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

            // Hold the page still while the finger reads along the dock.
            event.preventDefault();

            const touch = event.touches[0];
            const under = document.elementFromPoint(touch.clientX, touch.clientY);
            const control = controlFrom(under);

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
           otherwise produce, so holding the email button doesn't open mail. */
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
        toggle.dataset.label = collapsed ? 'Expand Projects' : 'Collapse Projects';
        dockLabel.refresh(toggle);
    }

    setCollapsed(false);

    toggle.addEventListener('click', () => {
        setCollapsed(!document.body.classList.contains('projects-collapsed'));
    });
}

/* --------------------------------------------
   Motion — entrance choreography + image parallax

   Content marked [data-enter] rises and fades as it scrolls into view,
   staggered within each section. Banner images marked [data-parallax]
   drift within their frame as they pass through the viewport. Both are
   inert under prefers-reduced-motion — the CSS neutralises them and this
   module skips its work.
   -------------------------------------------- */

const ENTER_STAGGER_MS = 90;   /* keep in step with --enter-stagger in the CSS */
const PARALLAX_STRENGTH = 0.5; /* half — image drift tips into gimmick fastest */

function prefersReducedMotionNow() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initializeEntrance() {
    const items = [...document.querySelectorAll('[data-enter]')];
    if (!items.length) return;

    // Reduced motion: reveal everything immediately, run nothing.
    if (prefersReducedMotionNow() || !('IntersectionObserver' in window)) {
        items.forEach(el => el.classList.add('is-in'));
        return;
    }

    // Stagger within each section by DOM order, so a heading leads and its
    // supporting lines follow.
    document.querySelectorAll('.project, .hello, .works').forEach(section => {
        section.querySelectorAll('[data-enter]').forEach((el, i) => {
            el.style.transitionDelay = (i * ENTER_STAGGER_MS) + 'ms';
        });
    });

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);   // reveal once, then stop watching
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    // Anything on screen at load (hero and first project, including its
    // description) fades in straight away, keeping its stagger; anything
    // fully below the fold waits for the observer, so each later project
    // reveals as it is scrolled to. The threshold is the full viewport
    // height, so nothing sitting near the fold slips through both checks.
    const viewportBottom = window.innerHeight;
    items.forEach(el => {
        const box = el.getBoundingClientRect();
        const inViewOnLoad = box.top < viewportBottom && box.bottom > 0;
        if (inViewOnLoad) {
            el.classList.add('is-in');
        } else {
            io.observe(el);
        }
    });
}

function initializeParallax() {
    if (prefersReducedMotionNow()) return;

    const images = [...document.querySelectorAll('[data-parallax] img')];
    if (!images.length) return;

    document.body.classList.add('parallax-on');   // unlocks the CSS headroom
    let ticking = false;

    function drift() {
        ticking = false;
        const vh = window.innerHeight;

        images.forEach(img => {
            const frame = img.parentElement.getBoundingClientRect();
            if (frame.bottom < 0 || frame.top > vh) return;   // off-screen: skip

            // -1 with the frame low in the viewport, +1 with it high.
            const progress = 1 - (frame.top + frame.height / 2) / (vh + frame.height) * 2;
            const shift = progress * -4.5 * PARALLAX_STRENGTH; // percent of image height
            // Written as a variable so it composes with the CSS centring
            // offset rather than replacing the whole transform.
            img.style.setProperty('--parallax-shift', shift.toFixed(2) + '%');
        });
    }

    function queue() {
        if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(drift);
        }
    }

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
    drift();
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
    startHelloAnimation();
    dockLabel.init();
    initializeTheme();
    initializeScroll();
    initializeProjectCollapse();
    initializeScrollTop();
    initializeWidget();
    initializeEntrance();
    initializeParallax();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    start();
}
