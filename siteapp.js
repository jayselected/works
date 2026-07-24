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
    startHelloAnimation();
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
