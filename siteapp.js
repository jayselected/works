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
    light: '#FCFBF9',
    dark:  '#141210'
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
   Dock labels

   Names whichever control is under the pointer, like the macOS dock.
   Three ways in: mouse hover, keyboard focus, and — on touch — a long
   press that can be dragged across the dock to read each control in
   turn, the way iOS keyboard key previews work.
   -------------------------------------------- */

const LONG_PRESS_MS = 400;

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
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    start();
}
