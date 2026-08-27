/* Theme */

const THEME_KEY = "wwwonderlan-theme";

/* Must match --bg. */
const THEME_BACKGROUNDS = { light: "#FFFFFF", dark: "#000000" };

const themeButtons = document.querySelectorAll("[data-set-theme]");
const prefersLight = matchMedia("(prefers-color-scheme: light)");

const storedTheme = () => {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
};

/* Only persist on an explicit choice — storing on load would freeze out the
   device setting after the first visit. */
function applyTheme(theme, persist) {
  document.documentElement.dataset.theme = theme;
  document.getElementById("theme-color").setAttribute("content", THEME_BACKGROUNDS[theme]);

  /* Pressed marks the theme in use; the other dims. */
  themeButtons.forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.setTheme === theme)));

  if (!persist) return;

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* Storage disabled; theme holds for this session only. */
  }
}

applyTheme(document.documentElement.dataset.theme, false);

themeButtons.forEach((button) =>
  button.addEventListener("click", () => applyTheme(button.dataset.setTheme, true)));

/* Follows the device unless a choice was made here. */
prefersLight.addEventListener("change", (event) => {
  if (storedTheme()) return;
  applyTheme(event.matches ? "light" : "dark", false);
});

/* Scroll progress and back to top */

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const progressFill = document.getElementById("scroll-progress-fill");

let queued = false;

function render() {
  queued = false;

  const scrollable = document.documentElement.scrollHeight - innerHeight;
  const ratio = scrollable > 0 ? Math.min(1, Math.max(0, scrollY / scrollable)) : 0;

  progressFill.style.transform = `scaleX(${ratio})`;
}

/* Scroll fires far more often than the screen refreshes. */
function queueRender() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(render);
}

addEventListener("scroll", queueRender, { passive: true });
addEventListener("resize", queueRender, { passive: true });

/* Page height changes as posters load. */
new ResizeObserver(queueRender).observe(document.body);

render();

document.getElementById("scroll-top").addEventListener("click", () =>
  scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" }));

/* Logo handoff — header to dock. Observing the header rather than a scroll
   offset keeps it right at any header height. */

const header = document.getElementById("header");
const dock = document.getElementById("dock");

new IntersectionObserver(([entry]) => {
  header.classList.toggle("is-handed-off", !entry.isIntersecting);
  dock.classList.toggle("is-collapsed", entry.isIntersecting);
}).observe(header);

/* Details — visibility rather than [hidden], so it can transition and still
   leave the tab order when closed. */

const details = document.getElementById("details");
const detailsToggle = document.getElementById("details-toggle");
const page = document.querySelector("main");

let restoreScroll = 0;

function openDetails() {
  /* Opens below the header, so the header has to be in view. */
  restoreScroll = scrollY;
  scrollTo({ top: 0, behavior: "auto" });

  details.classList.add("is-open");
  detailsToggle.setAttribute("aria-expanded", "true");
  document.documentElement.classList.add("is-locked");
  page.inert = true;

  document.getElementById("details-close").focus();
}

function closeDetails() {
  details.classList.remove("is-open");
  detailsToggle.setAttribute("aria-expanded", "false");
  document.documentElement.classList.remove("is-locked");
  page.inert = false;

  scrollTo({ top: restoreScroll, behavior: "auto" });
  detailsToggle.focus();
}

detailsToggle.addEventListener("click", () =>
  details.classList.contains("is-open") ? closeDetails() : openDetails());

document.getElementById("details-close").addEventListener("click", closeDetails);

addEventListener("keydown", (event) => {
  if (event.key === "Escape" && details.classList.contains("is-open")) closeDetails();
});
