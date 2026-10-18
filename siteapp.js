/**
 * Portfolio behaviour: the hero (cycling greeting, live date, local
 * conditions) and the dock (theme, scroll progress, labels, collapse).
 * The one script outside this file is the theme bootstrap in the head,
 * which must run before first paint.
 */

/* ============================================
   Shared
   ============================================ */

/* Read live, so a change to the OS setting mid-session is respected. */
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* Reads a duration token from the stylesheet, so timings shared with the
   CSS are stated once. */
function cssDuration(name, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (raw.endsWith('ms')) return parseFloat(raw) || fallback;
    if (raw.endsWith('s')) return parseFloat(raw) * 1000 || fallback;
    return fallback;
}

function pad(value) {
    return String(value).padStart(2, '0');
}

/* ============================================
   Hero: greeting
   ============================================ */

const HELLO_LANGUAGES = [
    'Hello.', 'Hola.', 'Bonjour.', 'Hallo.', 'Ciao.', 'Olá.', 'Привет.',
    '你好.', 'こんにちは.', '안녕하세요.', 'नमस्ते.', 'مرحبا.', 'Hej.', 'Merhaba.'
];

const HELLO_HOLD_MS = 2400;   /* how long each greeting is held */
const HERO_BEAT_MS = 300;     /* when the hero arrives, after the script starts */

let startedAt = 0;
let fadeMs = 1100;            /* replaced by --hero-ms at start */
let languageIndex = 0;

/* Everything in the hero reveals on one beat, never sooner: a class added in
   the frame an element first paints has nothing to fade from. */
function revealOnBeat(elements) {
    const wait = Math.max(0, startedAt + HERO_BEAT_MS - Date.now());
    setTimeout(() => elements.forEach(el => el.classList.add('visible')), wait);
}

function nextGreeting(el) {
    el.textContent = HELLO_LANGUAGES[languageIndex];
    languageIndex = (languageIndex + 1) % HELLO_LANGUAGES.length;
}

/* Fade out, swap the word once it is invisible, fade back in, hold. */
function cycleGreeting(el) {
    el.classList.remove('visible');

    setTimeout(() => {
        nextGreeting(el);
        el.classList.add('visible');
        setTimeout(() => cycleGreeting(el), HELLO_HOLD_MS);
    }, fadeMs);
}

function initializeGreeting() {
    const hello = document.getElementById('hero-hello');
    const name = document.querySelector('.hero-name');
    if (!hello) return;

    nextGreeting(hello);
    revealOnBeat([hello, name].filter(Boolean));
    setTimeout(() => cycleGreeting(hello), HERO_BEAT_MS + HELLO_HOLD_MS);
}

/* ============================================
   Hero: date and local conditions
   ============================================ */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

function initializeClock() {
    const clock = document.getElementById('hero-date');
    if (!clock) return;

    const tick = () => {
        const now = new Date();
        clock.textContent =
            `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ` +
            `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        /* Wake on the next second boundary, so the seconds never stall or
           skip the way a plain interval can. */
        setTimeout(tick, 1000 - (Date.now() % 1000));
    };

    tick();
    revealOnBeat([clock]);
}

function initializeConditions() {
    const line = document.getElementById('hero-place');
    if (!line) return;

    getConditions()
        .then(({ city, country, label, temperature }) => {
            const where = [city, country].filter(Boolean).join(', ');
            const what = `${label} ${temperature}°`.trim();
            line.textContent = where ? `${where}. ${what}` : what;
            revealOnBeat([line]);
        })
        /* Without a reading the line is removed, and the hero closes up. */
        .catch(() => { line.hidden = true; });
}

/* ============================================
   Location and weather

   IP geolocation (a second provider as fallback) and Open-Meteo, none of
   which need a key. Cached for half an hour per session.
   ============================================ */

const WEATHER_CACHE_KEY = 'site-conditions-v3';
const WEATHER_CACHE_MS = 30 * 60 * 1000;

/* WMO weather codes, grouped the way a person would describe them. */
const CONDITIONS = {
    0: 'Clear',             1: 'Mainly Clear',     2: 'Partly Cloudy',
    3: 'Overcast',         45: 'Fog',             48: 'Rime Fog',
    51: 'Light Drizzle',   53: 'Drizzle',         55: 'Heavy Drizzle',
    56: 'Freezing Drizzle', 57: 'Freezing Drizzle',
    61: 'Light Rain',      63: 'Rain',            65: 'Heavy Rain',
    66: 'Freezing Rain',   67: 'Freezing Rain',
    71: 'Light Snow',      73: 'Snow',            75: 'Heavy Snow',
    77: 'Snow Grains',     80: 'Showers',         81: 'Showers',
    82: 'Heavy Showers',   85: 'Snow Showers',    86: 'Snow Showers',
    95: 'Thunderstorm',    96: 'Thunderstorm',    99: 'Thunderstorm'
};

function readCachedWeather() {
    try {
        const cached = JSON.parse(sessionStorage.getItem(WEATHER_CACHE_KEY));
        return cached && Date.now() - cached.at < WEATHER_CACHE_MS ? cached : null;
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
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

async function resolveLocation() {
    try {
        const data = await fetchJson('https://ipwho.is/');
        if (data.success !== false && Number.isFinite(data.latitude)) {
            return { city: data.city || '', country: data.country || '',
                     latitude: data.latitude, longitude: data.longitude };
        }
    } catch (error) {
        /* fall through to the second provider */
    }

    const data = await fetchJson('https://ipapi.co/json/');
    if (data.error || !Number.isFinite(data.latitude)) throw new Error('no location');
    return { city: data.city || '', country: data.country_name || '',
             latitude: data.latitude, longitude: data.longitude };
}

/* Resolves to { city, country, label, temperature }. */
async function getConditions() {
    const cached = readCachedWeather();
    if (cached) return cached;

    const place = await resolveLocation();
    const { current } = await fetchJson(
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${place.latitude}&longitude=${place.longitude}` +
        '&current=temperature_2m,weather_code,is_day'
    );

    /* A clear sky reads as "Sunny" only while the sun is up. */
    const label = current.weather_code === 0
        ? (current.is_day ? 'Sunny' : 'Clear')
        : (CONDITIONS[current.weather_code] || '');

    const payload = {
        city: place.city,
        country: place.country,
        label,
        temperature: Math.round(current.temperature_2m),
        at: Date.now()
    };
    writeCachedWeather(payload);
    return payload;
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
        </svg>`,
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
        </svg>`
};

/* The stored choice, or null while there has not been one. Null is what
   keeps the site following the system. */
function storedTheme() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        return saved === 'dark' || saved === 'light' ? saved : null;
    } catch (error) {
        return null;
    }
}

/* remember: false paints without recording, for when the page is following
   the system and that must not silently become a choice. */
function applyTheme(theme, remember = true) {
    document.documentElement.dataset.theme = theme;

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.innerHTML = THEME_ICONS[theme];
        toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        toggle.dataset.label = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
        dockLabel.refresh(toggle);
    }

    document.getElementById('theme-color')?.setAttribute('content', THEME_BACKGROUNDS[theme]);

    if (!remember) return;
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        /* Storage disabled: the theme holds for this visit, unremembered. */
    }
}

function initializeTheme() {
    const toggle = document.getElementById('theme-toggle');
    const system = window.matchMedia('(prefers-color-scheme: dark)');

    /* The head has already applied the theme; this paints the toggle to
       match, and records it only if it was a choice to begin with. */
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', storedTheme() !== null);

    toggle?.addEventListener('click', () => {
        applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    /* Until the toggle is pressed the page follows the system, live. */
    system.addEventListener('change', event => {
        if (storedTheme() === null) applyTheme(event.matches ? 'dark' : 'light', false);
    });
}

/* ============================================
   Scroll

   The dock answers the scroll twice: the progress bar fills, and the light
   on its glass rim turns, a full turn every RIM_TURN_PX. The angle eases
   toward the scroll rather than jumping with it, settling over about a
   second once the page stops.
   ============================================ */

const RIM_TURN_PX = 2400;
const RIM_EASE_MS = 300;   /* time constant: ~95% of the way in three */

function initializeScroll() {
    const dock = document.querySelector('.dock');
    const progress = document.getElementById('scroll-progress');
    const fill = document.getElementById('scroll-progress-fill');
    if (!dock || !progress || !fill) return;

    let queued = false;
    let rimTarget = (window.scrollY / RIM_TURN_PX) * 360;
    let rimAngle = rimTarget;
    let rimFrame = 0;
    let rimLast = 0;

    const paintRim = () => dock.style.setProperty('--rim-turn', `${rimAngle.toFixed(2)}deg`);

    function turnRim(now) {
        const dt = Math.min(64, now - rimLast);
        rimLast = now;
        rimAngle += (rimTarget - rimAngle) * (1 - Math.exp(-dt / RIM_EASE_MS));
        if (Math.abs(rimTarget - rimAngle) < 0.05) rimAngle = rimTarget;

        paintRim();
        rimFrame = rimAngle === rimTarget ? 0 : requestAnimationFrame(turnRim);
    }

    function render() {
        queued = false;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;

        fill.style.transform = `scaleX(${ratio})`;
        progress.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));

        /* Tied to the reader's own scrolling, but still motion: held still
           for anyone who has asked for less. */
        rimTarget = (window.scrollY / RIM_TURN_PX) * 360;
        if (!rimFrame && rimTarget !== rimAngle && !prefersReducedMotion()) {
            rimLast = performance.now();
            rimFrame = requestAnimationFrame(turnRim);
        }
    }

    /* Scroll fires far more often than the screen refreshes. */
    function queue() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(render);
    }

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
    /* The page changes height as images load and projects collapse. */
    new ResizeObserver(queue).observe(document.body);

    /* A page restored part-way down starts with its rim already turned. */
    paintRim();
    render();
}

/* ============================================
   Dock labels

   Names the control under the pointer, like the macOS dock: on hover, on
   keyboard focus, and on touch by a long press that can be dragged across
   the dock to read each control in turn.
   ============================================ */

const LONG_PRESS_MS = 250;

const dockLabel = (() => {
    let dock = null;
    let label = null;
    let active = null;          /* the control currently named */
    let pressTimer = null;
    let longPressed = false;    /* swallows the click that would follow */

    const controlFrom = node => node?.closest?.('[data-label]') ?? null;

    /* Centred on the control, but kept within the dock so it never runs off
       the screen's edge. */
    function place(control) {
        const dockBox = dock.getBoundingClientRect();
        const box = control.getBoundingClientRect();
        const half = label.offsetWidth / 2;
        const centre = box.left + box.width / 2 - dockBox.left;
        label.style.left = `${Math.max(half, Math.min(dockBox.width - half, centre))}px`;
    }

    function show(control) {
        if (!control?.dataset.label) return;
        active = control;
        label.textContent = control.dataset.label;
        place(control);                       /* placed first, so it never slides in from elsewhere */
        label.classList.add('is-visible');
    }

    function hide() {
        active = null;
        label?.classList.remove('is-visible');
    }

    /* For a control whose label changes while it may be showing. */
    function refresh(control) {
        if (label && active === control) show(control);
    }

    function init() {
        dock = document.querySelector('.dock');
        label = document.getElementById('dock-label');
        if (!dock || !label) return;

        /* Mouse only: touch has its own path below, and both would flash the
           label on every tap. */
        dock.addEventListener('pointerover', event => {
            if (event.pointerType === 'mouse') show(controlFrom(event.target));
        });

        dock.addEventListener('pointerout', event => {
            if (event.pointerType !== 'mouse') return;
            const control = controlFrom(event.target);
            if (control && !control.contains(event.relatedTarget)) hide();
        });

        dock.addEventListener('focusin', event => show(controlFrom(event.target)));
        dock.addEventListener('focusout', hide);

        dock.addEventListener('touchstart', event => {
            const control = controlFrom(event.target);
            if (!control) return;

            longPressed = false;
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                longPressed = true;
                show(control);
            }, LONG_PRESS_MS);
        }, { passive: true });

        dock.addEventListener('touchmove', event => {
            /* Moving before the press registers is a scroll, not a hold. */
            if (!longPressed) {
                clearTimeout(pressTimer);
                return;
            }

            event.preventDefault();   /* hold the page still while reading */
            const { clientX, clientY } = event.touches[0];
            const control = controlFrom(document.elementFromPoint(clientX, clientY));

            if (!control) hide();
            else if (control !== active) show(control);
        }, { passive: false });

        const endTouch = () => {
            clearTimeout(pressTimer);
            if (longPressed) hide();
        };
        dock.addEventListener('touchend', endTouch);
        dock.addEventListener('touchcancel', endTouch);

        /* A long press is a read, not a tap: holding Email must not open mail. */
        dock.addEventListener('click', event => {
            if (!longPressed) return;
            event.preventDefault();
            event.stopPropagation();
            longPressed = false;
        }, true);

        window.addEventListener('resize', () => active && place(active), { passive: true });
    }

    return { init, refresh };
})();

/* ============================================
   Project collapse

   Reduces every project to its title and banner, two across. A layout
   change cannot be transitioned directly, so where the browser supports
   view transitions the swap runs inside one and is interpolated.

   Collapsing keeps the project being read in view; opening a card brings
   that project to the top. Either way the scroll happens inside the same
   update as the layout change, so the transition captures the page already
   in place and the cards gather or grow where the reader is looking.
   ============================================ */

const COLLAPSE_ICONS = {
    collapse: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m14 10 7-7"></path>
            <path d="M20 10h-6V4"></path>
            <path d="m3 21 7-7"></path>
            <path d="M4 14h6v6"></path>
        </svg>`,
    expand: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 3h6v6"></path>
            <path d="m21 3-7 7"></path>
            <path d="m3 21 7-7"></path>
            <path d="M9 21H3v-6"></path>
        </svg>`
};

function initializeProjectCollapse() {
    const toggle = document.getElementById('project-collapse');
    const works = document.querySelector('.works');
    const dock = document.querySelector('.dock');
    if (!toggle || !works) return;

    const projects = [...works.querySelectorAll('.project')];
    let collapsed = false;

    /* A name per project lets each travel on its own between the layouts,
       rather than the whole list cross-fading as one block. */
    projects.forEach((project, index) => {
        project.style.viewTransitionName = `project-${index + 1}`;
    });

    function paint() {
        document.body.classList.toggle('projects-collapsed', collapsed);

        toggle.innerHTML = collapsed ? COLLAPSE_ICONS.expand : COLLAPSE_ICONS.collapse;
        toggle.setAttribute('aria-label', collapsed ? 'Expand projects' : 'Collapse projects');
        toggle.setAttribute('aria-pressed', String(collapsed));
        toggle.dataset.label = collapsed ? 'Expand Projects' : 'Collapse Projects';
        dockLabel.refresh(toggle);

        /* Collapsed, each card is a button that opens the list at itself. */
        projects.forEach(project => {
            if (collapsed) {
                project.setAttribute('role', 'button');
                project.setAttribute('tabindex', '0');
                project.setAttribute('aria-label', `${project.querySelector('h2').textContent.trim()}, expand projects`);
                project.querySelectorAll('[data-enter]').forEach(el => el.classList.add('is-in'));
            } else {
                project.removeAttribute('role');
                project.removeAttribute('tabindex');
                project.removeAttribute('aria-label');
            }
        });
    }

    /* A project's title lands one block of air below the top of the screen. */
    function scrollToProject(project) {
        const air = parseFloat(getComputedStyle(project).rowGap) || 0;
        const top = project.getBoundingClientRect().top + window.scrollY - air;
        window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    }

    /* The project being read: the first still filling the upper screen.
       None while the hero is in view, so collapsing there stays put. */
    function projectInView() {
        if (works.getBoundingClientRect().top > 0) return null;
        return projects.find(project => project.getBoundingClientRect().bottom > window.innerHeight / 4) ?? null;
    }

    function setCollapsed(next, opened = null, byKeyboard = false) {
        if (next === collapsed) return;
        collapsed = next;

        const anchor = collapsed ? projectInView() : opened;

        const update = () => {
            paint();
            if (!anchor) return;
            scrollToProject(anchor);

            /* Focus follows a card opened from the keyboard, so keyboard and
               screen reader users land where the eye does. */
            if (byKeyboard) {
                const title = anchor.querySelector('h2');
                title.tabIndex = -1;
                title.focus({ preventScroll: true });
                title.addEventListener('blur', () => title.removeAttribute('tabindex'), { once: true });
            }
        };

        if (prefersReducedMotion() || !document.startViewTransition) {
            update();
            return;
        }

        /* The dock is named only for the length of the morph, so it holds
           still: a permanent name would stop its glass sampling the page. */
        if (dock) dock.style.viewTransitionName = 'dock';
        const release = () => { if (dock) dock.style.viewTransitionName = ''; };
        const transition = document.startViewTransition(update);
        /* A morph cut short, by a second click or a hidden tab, is not an
           error: the page still updates, it just doesn't animate. */
        transition.ready.catch(() => {});
        transition.finished.then(release, release);
    }

    paint();

    toggle.addEventListener('click', () => setCollapsed(!collapsed));

    works.addEventListener('click', event => {
        if (collapsed) setCollapsed(false, event.target.closest('.project'));
    });

    works.addEventListener('keydown', event => {
        if (collapsed && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setCollapsed(false, event.target.closest('.project'), true);
        }
    });
}

/* ============================================
   Entrance

   Content marked [data-enter] rises gently in as it is reached: at once if
   it is already on screen, otherwise as it scrolls into view.
   ============================================ */

function initializeEntrance() {
    const items = [...document.querySelectorAll('[data-enter]')];
    const reveal = el => el.classList.add('is-in');

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
        items.forEach(reveal);
        return;
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            reveal(entry.target);
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    items.forEach(el => {
        const { top, bottom } = el.getBoundingClientRect();
        if (top < window.innerHeight && bottom > 0) reveal(el);
        else observer.observe(el);
    });
}

/* ============================================
   Fallback font

   Apple devices draw the system font, which tracks itself. Everyone else
   draws the self-hosted SF Pro Text, which cannot; once it is known to be
   the face in use, the stylesheet applies Apple's tracking by hand. A face
   the stack never reached is never requested, so "loaded" is proof.

   Checked after load, not at start: only once the page has been laid out
   has every face it needs been requested, for fonts.ready to wait on.
   ============================================ */

function initializeFallbackFont() {
    if (!document.fonts) return;

    const check = () => {
        const inUse = [...document.fonts].some(face =>
            face.family.replace(/["']/g, '') === 'SF Pro Text' && face.status === 'loaded');
        if (inUse) document.documentElement.dataset.font = 'static';
    };

    if (document.readyState === 'complete') document.fonts.ready.then(check);
    else window.addEventListener('load', () => document.fonts.ready.then(check), { once: true });
}

/* ============================================
   Back to top
   ============================================ */

function initializeScrollTop() {
    document.getElementById('scroll-top')?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
}

/* ============================================
   Start
   ============================================ */

function start() {
    startedAt = Date.now();
    fadeMs = cssDuration('--hero-ms', fadeMs);

    /* Each module is isolated, so one failing cannot take the rest with it.
       The dock label goes first: the theme and collapse modules refresh it. */
    [
        dockLabel.init,
        initializeGreeting,
        initializeClock,
        initializeConditions,
        initializeTheme,
        initializeScroll,
        initializeProjectCollapse,
        initializeEntrance,
        initializeFallbackFont,
        initializeScrollTop
    ].forEach(run => {
        try {
            run();
        } catch (error) {
            console.error('[site] module failed:', error);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
    start();
}
