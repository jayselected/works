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
const HERO_BEAT_MS = 300;     /* the beat on which the hero arrives */

/* The moment the hero is due. Everything in it reveals then — together, and
   never sooner: a class added in the same frame an element first exists has
   no transparent state to fade from, so it would simply appear. */
const heroDue = () => startedAt + HERO_BEAT_MS;
let startedAt = 0;

/* Reveals on the hero's beat, however early the caller is ready. */
function revealOnBeat(elements) {
    const wait = Math.max(0, heroDue() - Date.now());
    setTimeout(() => elements.forEach(el => el.classList.add('visible')), wait);
}

/* Set from --hero-ms at start: the swap waits for the fade-out to finish,
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

    /* Greeting and name arrive on the beat together; the name then stays
       while the languages keep cycling above it. */
    revealOnBeat([el, name].filter(Boolean));
    setTimeout(runFadeSequence, HERO_BEAT_MS + HELLO_HOLD_MS);
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
        /* On the beat, with the greeting and the name — not on load, which
           would skip the fade entirely. */
        revealOnBeat(clocks);

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

                /* Held to the same beat, so a cached reading — which returns
                   almost at once — arrives with the rest rather than ahead
                   of it. A first visit fades in when the lookup lands. */
                revealOnBeat([...document.querySelectorAll('[data-conditions], [data-place], [data-weather]')]);
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
    document.querySelectorAll(selector).forEach(el => { el.textContent = text; });
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
   Carousel

   Scrolling, swiping and snapping are native, so there is no gesture code
   here. This builds the dots from however many slides exist, marks the one
   in frame, routes the arrow keys to whichever carousel is being looked at,
   and opens the viewer. The viewer runs the same controller over the same
   images, so enlarged behaviour is identical by construction.
   ============================================ */

function setupCarousel(root, onPick) {
    const track = root.querySelector('[data-track]');
    if (!track || track.children.length < 2) return null;

    /* Looping is done with copies rather than a jump. The last slide is
       repeated before the first and the first after the last, so leaving
       either end is an ordinary scroll in the direction of travel. Once the
       strip is resting on a copy it is shifted by exactly one cycle onto the
       real slide — invisible, because the two are the same picture at the
       same offset within the frame. */
    const real = [...track.children];
    const count = real.length;

    const head = real[count - 1].cloneNode(true);
    const tail = real[0].cloneNode(true);
    [head, tail].forEach(copy => {
        copy.dataset.copy = '';
        copy.setAttribute('aria-hidden', 'true');
    });
    track.prepend(head);
    track.append(tail);

    const slides = [...track.children];   // count + 2
    const FIRST = 1;                      // first real slide
    const LAST = count;                   // last real slide
    const COPY_END = count + 1;           // the copy that follows it

    const offsetOf = at => slides[at].offsetLeft - track.offsetLeft;
    const toReal = at => ((at - FIRST) + count) % count;
    /* One full cycle, measured rather than assumed, so it stays correct at
       any width and whatever the slides turn out to be. */
    const cycle = () => offsetOf(COPY_END) - offsetOf(FIRST);

    const dots = document.createElement('div');
    dots.className = 'carousel-dots';
    dots.setAttribute('role', 'tablist');
    dots.setAttribute('aria-label', 'Choose image');

    const buttons = real.map((slide, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel-dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', 'Image ' + (index + 1) + ' of ' + count);
        dot.addEventListener('click', () => goTo(index));
        dots.appendChild(dot);
        return dot;
    });

    root.appendChild(dots);

    let at = FIRST;         // the slide we are on, or moving to
    let current = 0;        // the real image that names it
    let steering = false;   // a move of ours is under way
    let holding = false;    // a finger is on the strip

    function mark(index) {
        if (index === current) return;
        current = index;
        buttons.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
    }

    function nearest() {
        const middle = track.scrollLeft + track.clientWidth / 2;
        let best = FIRST, shortest = Infinity;
        slides.forEach((slide, i) => {
            const gap = Math.abs((slide.offsetLeft - track.offsetLeft + slide.offsetWidth / 2) - middle);
            if (gap < shortest) { shortest = gap; best = i; }
        });
        return best;
    }

    /* Standing on a copy is always temporary. Shifting by one whole cycle
       moves onto the real twin while preserving the exact position within
       the frame, so it is unseen — at rest, and equally mid-gesture. */
    function normalise() {
        if (at >= COPY_END)  { track.scrollLeft -= cycle(); at -= count; }
        else if (at <= 0)    { track.scrollLeft += cycle(); at += count; }
    }

    function glide(to, instant) {
        const smooth = !instant && !prefersReducedMotion();
        at = to;
        steering = smooth;
        mark(toReal(to));
        track.scrollTo({ left: offsetOf(to), behavior: smooth ? 'smooth' : 'auto' });
    }

    /* Never step away from a copy: come back to the real slide first, at the
       same point in the frame, so the next move carries on rather than
       doubling back across the whole strip. */
    function step(offset) {
        normalise();
        glide(at + offset);
    }

    function goTo(index) {
        normalise();
        glide(FIRST + Math.max(0, Math.min(count - 1, index)));
    }

    function jumpTo(index) {
        glide(FIRST + Math.max(0, Math.min(count - 1, index || 0)), true);
    }

    /* Whatever moved the strip — key, dot, swipe or momentum — once it comes
       to rest we take the position at face value and normalise from there.
       This is what keeps a fast swipe cycling rather than stranding the
       strip on a copy with nowhere left to go. */
    function settle() {
        if (holding) return;   // still under a finger; wait for it to lift
        steering = false;
        at = nearest();
        mark(toReal(at));
        normalise();
    }

    /* Every frame of the scroll, each slide is faded and settled by how far
       it sits from the centre, so the next image arrives as the current one
       leaves and no two are ever seen flush together. Driven by position
       rather than events, it reads the same however the strip was moved. */
    function paint() {
        const frame = track.clientWidth;
        if (!frame) return;   // not laid out yet; the observers below re-run this

        const middle = track.scrollLeft + frame / 2;
        const reduced = prefersReducedMotion();
        let closest = FIRST, shortest = Infinity;

        slides.forEach((slide, i) => {
            const gap = Math.abs((slide.offsetLeft - track.offsetLeft + slide.offsetWidth / 2) - middle);
            if (gap < shortest) { shortest = gap; closest = i; }

            const away = Math.min(1, (gap / frame) * 1.15);   // 0 centred, 1 a frame away
            slide.style.opacity = String(1 - away);
            slide.style.transform = reduced ? '' : 'scale(' + (1 - away * 0.04) + ')';
        });

        /* During a move of ours the destination is already named; otherwise
           the dots follow the reader's own scrolling. */
        if (!steering) mark(toReal(closest));
    }

    let queued = false;
    let quiet = null;

    track.addEventListener('scroll', () => {
        clearTimeout(quiet);
        quiet = setTimeout(settle, 120);   // 120ms of stillness means it has stopped

        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; paint(); });
    }, { passive: true });

    /* scrollend is exact where it exists; the timer above covers the rest. */
    if ('onscrollend' in window) track.addEventListener('scrollend', settle);

    /* Nothing is repositioned under a live finger — that would fight the
       gesture. The strip is tidied the moment it is let go. */
    track.addEventListener('touchstart', () => { holding = true; }, { passive: true });
    ['touchend', 'touchcancel'].forEach(event => {
        track.addEventListener(event, () => {
            holding = false;
            clearTimeout(quiet);
            quiet = setTimeout(settle, 120);
        }, { passive: true });
    });

    /* Deliberately not focusable: the dots are the keyboard interface, and a
       ring around the strip reads as a rule against the artwork. */
    track.setAttribute('role', 'group');
    track.setAttribute('aria-roledescription', 'carousel');
    track.setAttribute('aria-label', count + ' images. Use the arrow keys to move between them.');

    if (onPick) {
        slides.forEach((slide, position) => {
            const image = slide.tagName === 'IMG' ? slide : slide.querySelector('img');
            if (image) image.addEventListener('click', () => onPick(toReal(position)));
        });
    }

    buttons[0].setAttribute('aria-current', 'true');
    jumpTo(0);
    paint();

    /* Images arrive at their own pace, and each one changes the geometry. */
    slides.forEach(slide => {
        const image = slide.tagName === 'IMG' ? slide : slide.querySelector('img');
        if (image && !image.complete) image.addEventListener('load', paint, { once: true });
    });

    /* A resize moves every offset, including the one we are parked on. */
    if ('ResizeObserver' in window) {
        new ResizeObserver(() => {
            track.scrollLeft = offsetOf(at);
            paint();
        }).observe(track);
    }

    return { root, step, goTo: jumpTo, index: () => current };
}

function initializeCarousels() {
    const roots = [...document.querySelectorAll('[data-carousel]')];
    if (!roots.length) return;

    const carousels = new Map();
    let inView = null;   // the one filling most of the screen

    /* The arrow keys should work the moment a carousel is reached, without
       clicking it first. A carousel claims them once it is at least half in
       view; anything less and the keys stay with the page, as they should.
       Where this is unavailable the carousel still works in every other
       respect — the keys simply wait until the strip is focused. */
    const watcher = 'IntersectionObserver' in window
        ? new IntersectionObserver(entries => {
            entries.forEach(entry => {
                entry.target.dataset.ratio = entry.intersectionRatio.toFixed(3);
            });

            let best = null, ratio = 0.5;
            carousels.forEach((carousel, root) => {
                const value = parseFloat(root.dataset.ratio || '0');
                if (value > ratio) { ratio = value; best = carousel; }
            });
            inView = best;
        }, { threshold: [0, 0.25, 0.5, 0.75, 1] })
        : null;

    /* Focus wins over proximity: if the reader has tabbed into a strip, that
       is the one they mean, wherever it sits on screen. */
    function active() {
        const focused = document.activeElement && document.activeElement.closest
            ? document.activeElement.closest('[data-carousel]')
            : null;
        return (focused && carousels.get(focused)) || inView;
    }

    const viewer = createViewer();

    roots.forEach(root => {
        const images = [...root.querySelectorAll('[data-track] > img')];
        const carousel = setupCarousel(root, viewer && (index => viewer.open(images, index)));
        if (!carousel) return;
        carousels.set(root, carousel);
        if (watcher) watcher.observe(root);
    });

    if (!carousels.size) return;

    /* Every visit starts on the first image. Two things would otherwise
       leave it elsewhere: browsers restore a scroll container's position on
       reload and when a page is returned to from history, and a strip that
       is measured before it has been laid out reads every offset as zero,
       which parks it on the copy that precedes the first slide. pageshow
       covers both, firing after any restoration. */
    window.addEventListener('pageshow', () => {
        carousels.forEach(carousel => carousel.goTo(0));
    });

    document.addEventListener('keydown', event => {
        const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        if (!step || event.metaKey || event.ctrlKey || event.altKey) return;

        /* Never steal the keys from a text field. */
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable)) return;

        const target = (viewer && viewer.isOpen()) ? viewer.carousel() : active();
        if (!target) return;

        event.preventDefault();
        target.step(step);
    });
}

/* --------------------------------------------
   Viewer — one dialog, reused by every carousel
   -------------------------------------------- */

function createViewer() {
    if (typeof HTMLDialogElement !== 'function') return null;

    const viewer = document.createElement('dialog');
    viewer.className = 'viewer';
    /* autofocus keeps the opening focus off the first dot; tabindex makes
       the container able to hold it. */
    viewer.innerHTML = '<div class="viewer-inner" tabindex="-1" autofocus><div class="carousel-track" data-track></div></div>';
    document.body.appendChild(viewer);

    const inner = viewer.querySelector('.viewer-inner');
    const track = viewer.querySelector('[data-track]');
    let carousel = null;

    function open(images, index) {
        track.replaceChildren(...images.map(source => {
            const slide = document.createElement('div');
            slide.className = 'viewer-slide';
            const img = document.createElement('img');
            /* currentSrc is what the browser actually loaded, so the
               enlarged view reuses the cached file rather than fetching. */
            img.src = source.currentSrc || source.src;
            img.alt = source.alt;
            img.decoding = 'async';
            slide.appendChild(img);
            return slide;
        }));

        inner.querySelectorAll('.carousel-dots').forEach(el => el.remove());
        carousel = setupCarousel(inner);

        document.body.classList.add('viewer-open');
        viewer.showModal();

        /* Placed on the image that was clicked before anything is visible,
           so it opens on that image rather than travelling to it. */
        if (carousel) carousel.goTo(index, true);

        /* Two frames: one for the slides to lay out, one to give the
           transition a start value to animate from. */
        requestAnimationFrame(() => requestAnimationFrame(() => viewer.classList.add('is-open')));
    }

    function close() {
        if (!viewer.classList.contains('is-open')) return;
        viewer.classList.remove('is-open');
        document.body.classList.remove('viewer-open');

        if (prefersReducedMotion()) {
            viewer.close();
            return;
        }

        /* Let it shrink away before the dialog goes; the timeout is the
           backstop if the transition never fires. */
        let done = false;
        const finish = () => { if (!done) { done = true; viewer.close(); } };
        inner.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, cssDuration('--viewer-ms', 320) + 60);
    }

    /* Escape closes the dialog outright, so mirror it back into the animation. */
    viewer.addEventListener('cancel', event => {
        event.preventDefault();
        close();
    });

    /* Anywhere but the image and the dots dismisses it. */
    viewer.addEventListener('click', event => {
        if (event.target.closest('.carousel-dot, .viewer-slide img')) return;
        close();
    });

    return {
        open,
        close,
        isOpen: () => viewer.classList.contains('is-open'),
        carousel: () => carousel
    };
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

    startedAt = Date.now();
    fadeMs = cssDuration('--hero-ms', fadeMs);

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
        initializeCarousels,
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
