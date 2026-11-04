import { browser } from 'wxt/browser';

// These run inside the web page via scripting.executeScript({ func }), so they must not use imports or outer variables.

function showScan(label: string): void {
  const ID = 'ija-scan-overlay';
  const w = window as unknown as { __ijaScan?: { root: ShadowRoot; timer: number; startedAt: number; finishing?: boolean } };
  const existing = document.getElementById(ID);
  if (existing && w.__ijaScan && !w.__ijaScan.finishing) {
    const pill = w.__ijaScan.root.querySelector('.label');
    if (pill) pill.textContent = label;
    return;
  }
  existing?.remove();
  const host = document.createElement('div');
  host.id = ID;
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }

      /* Full-DOM subtle glass veil */
      .veil {
        position: fixed; inset: 0;
        background: radial-gradient(ellipse at 50% 50%, rgba(99, 102, 241, 0.06) 0%, rgba(168, 85, 247, 0.04) 50%, rgba(15, 23, 42, 0.1) 100%);
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
        transition: opacity 0.6s ease, background 0.6s ease;
      }

      /* Glowing fluid perimeter framing the viewport */
      .perimeter {
        position: fixed; inset: 0;
        box-shadow: inset 0 0 80px rgba(99, 102, 241, 0.22), inset 0 0 160px rgba(168, 85, 247, 0.12);
        animation: perimeter-breathe 4s ease-in-out infinite alternate;
        transition: box-shadow 0.6s ease;
      }

      /* Top fluid streaming iridescent line */
      .stream {
        position: fixed; top: 0; left: 0; right: 0; height: 3.5px;
        background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #06b6d4, #6366f1);
        background-size: 300% 100%;
        animation: fluid-stream 3s linear infinite;
        box-shadow: 0 0 16px 2px rgba(168, 85, 247, 0.6);
        transition: background 0.5s ease, box-shadow 0.5s ease;
      }

      /* Full-DOM Organic Fluid Aurora Mesh (NO SWEEP - morphs and breathes in place) */
      .aurora-mesh {
        position: fixed; inset: 0; pointer-events: none; overflow: hidden;
      }
      .blob {
        position: absolute;
        filter: blur(90px);
        opacity: 0.22;
        mix-blend-mode: screen;
        pointer-events: none;
        transition: opacity 0.6s ease, background 0.8s ease;
      }

      /* Blob 1: Top-Left (Violet / Indigo) */
      .blob-1 {
        width: 580px; height: 580px; top: -160px; left: -140px;
        background: radial-gradient(circle, #6366f1 0%, #8b5cf6 55%, transparent 75%);
        animation: morph-1 9s ease-in-out infinite alternate;
      }

      /* Blob 2: Top-Right (Cyan / Azure) */
      .blob-2 {
        width: 540px; height: 540px; top: -140px; right: -120px;
        background: radial-gradient(circle, #38bdf8 0%, #6366f1 60%, transparent 75%);
        animation: morph-2 8s ease-in-out infinite alternate;
      }

      /* Blob 3: Center (Fuchsia / Orchid) */
      .blob-3 {
        width: 650px; height: 650px; top: 25%; left: 25%;
        background: radial-gradient(circle, #c084fc 0%, #ec4899 50%, transparent 75%);
        animation: morph-3 11s ease-in-out infinite alternate;
      }

      /* Blob 4: Bottom-Left (Sky Blue / Purple) */
      .blob-4 {
        width: 560px; height: 560px; bottom: -160px; left: -100px;
        background: radial-gradient(circle, #06b6d4 0%, #818cf8 60%, transparent 75%);
        animation: morph-4 10s ease-in-out infinite alternate;
      }

      /* Blob 5: Bottom-Right (Indigo / Magenta) */
      .blob-5 {
        width: 580px; height: 580px; bottom: -150px; right: -120px;
        background: radial-gradient(circle, #a855f7 0%, #3b82f6 55%, transparent 75%);
        animation: morph-5 9.5s ease-in-out infinite alternate;
      }

      /* Sleek floating glassmorphism pill */
      .pill {
        position: fixed; top: 20px; right: 24px;
        display: flex; align-items: center; gap: 10px;
        padding: 8px 14px 8px 10px; border-radius: 9999px;
        background: rgba(15, 23, 42, 0.88);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #f8fafc;
        font: 500 13px/1.3 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        letter-spacing: -0.01em;
        box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.4), 0 0 20px rgba(99, 102, 241, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.06);
        animation: pill-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transform-origin: top right;
      }

      .orb-wrap {
        position: relative; width: 22px; height: 22px;
        display: flex; align-items: center; justify-content: center;
      }
      .orb-halo {
        position: absolute; inset: -3px; border-radius: 50%;
        background: radial-gradient(circle, rgba(168, 85, 247, 0.55) 0%, transparent 70%);
        animation: halo-breathe 2.4s ease-in-out infinite;
      }
      .orb-core {
        position: relative; width: 22px; height: 22px; border-radius: 50%;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(168, 85, 247, 0.4));
        border: 1px solid rgba(168, 85, 247, 0.5);
        display: flex; align-items: center; justify-content: center;
      }
      .sparkle-icon {
        width: 13px; height: 13px;
        animation: sparkle-spin 6s linear infinite;
      }
      .check-icon, .error-icon {
        display: none; width: 13px; height: 13px;
      }

      /* Animated harmonic fluid wave bars */
      .bars {
        display: flex; align-items: center; gap: 2.5px; height: 12px;
      }
      .bars span {
        width: 2.5px; border-radius: 99px;
        background: linear-gradient(to top, #818cf8, #c084fc);
        animation: bar-wave 1.2s ease-in-out infinite;
      }
      .bars span:nth-child(1) { height: 6px; animation-delay: 0s; }
      .bars span:nth-child(2) { height: 12px; animation-delay: 0.2s; }
      .bars span:nth-child(3) { height: 8px; animation-delay: 0.4s; }

      .label {
        font-weight: 500; color: #f1f5f9; white-space: nowrap;
      }

      .tag {
        font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
        color: #c7d2fe; background: rgba(99, 102, 241, 0.2);
        border: 1px solid rgba(129, 140, 248, 0.3);
        padding: 2px 7px; border-radius: 999px; margin-left: 2px;
      }

      /* Finished & Error States */
      .done .sparkle-icon, .done .bars { display: none; }
      .done .check-icon { display: block; animation: pop 0.25s ease-out; }
      .done .orb-core {
        background: rgba(16, 185, 129, 0.25); border-color: rgba(52, 211, 153, 0.6);
      }
      .done .orb-halo {
        background: radial-gradient(circle, rgba(16, 185, 129, 0.5) 0%, transparent 70%);
      }
      .done .tag {
        color: #6ee7b7; background: rgba(16, 185, 129, 0.2); border-color: rgba(52, 211, 153, 0.35);
      }
      .done .veil {
        background: rgba(16, 185, 129, 0.09);
      }
      .done .perimeter {
        box-shadow: inset 0 0 90px rgba(16, 185, 129, 0.35), inset 0 0 160px rgba(52, 211, 153, 0.2);
      }
      .done .stream {
        background: linear-gradient(90deg, #10b981, #34d399, #059669);
        box-shadow: 0 0 16px rgba(52, 211, 153, 0.7);
      }
      .done .blob {
        background: radial-gradient(circle, #10b981 0%, #059669 60%, transparent 75%) !important;
        opacity: 0.18;
      }

      .error .sparkle-icon, .error .bars { display: none; }
      .error .error-icon { display: block; animation: pop 0.25s ease-out; }
      .error .orb-core {
        background: rgba(239, 68, 68, 0.25); border-color: rgba(248, 113, 113, 0.6);
      }
      .error .orb-halo {
        background: radial-gradient(circle, rgba(239, 68, 68, 0.5) 0%, transparent 70%);
      }
      .error .tag {
        color: #fca5a5; background: rgba(239, 68, 68, 0.2); border-color: rgba(248, 113, 113, 0.35);
      }
      .error .veil {
        background: rgba(239, 68, 68, 0.08);
      }
      .error .perimeter {
        box-shadow: inset 0 0 90px rgba(239, 68, 68, 0.35);
      }
      .error .stream {
        background: linear-gradient(90deg, #ef4444, #f87171, #dc2626);
        box-shadow: 0 0 16px rgba(248, 113, 113, 0.7);
      }
      .error .blob {
        background: radial-gradient(circle, #ef4444 0%, #dc2626 60%, transparent 75%) !important;
        opacity: 0.18;
      }

      .leaving .wrap, .leaving .pill, .leaving .veil, .leaving .perimeter, .leaving .stream, .leaving .blob {
        opacity: 0;
        transition: opacity 0.55s ease, transform 0.55s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .leaving .pill {
        transform: translateY(-8px) scale(0.96);
      }

      /* Fluid Morphing Keyframes (Continuous organic in-place motion) */
      @keyframes morph-1 {
        0% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; transform: translate(0, 0) scale(1) rotate(0deg); }
        33% { border-radius: 70% 30% 46% 54% / 30% 29% 71% 70%; transform: translate(35px, -20px) scale(1.08) rotate(15deg); }
        66% { border-radius: 100% 60% 60% 100% / 100% 100% 60% 60%; transform: translate(-20px, 25px) scale(0.95) rotate(-12deg); }
        100% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; transform: translate(0, 0) scale(1) rotate(0deg); }
      }
      @keyframes morph-2 {
        0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; transform: translate(0, 0) scale(1) rotate(0deg); }
        33% { border-radius: 35% 65% 60% 40% / 55% 45% 55% 45%; transform: translate(-30px, 30px) scale(1.1) rotate(-20deg); }
        66% { border-radius: 50% 50% 20% 80% / 25% 80% 20% 75%; transform: translate(25px, -20px) scale(0.94) rotate(12deg); }
        100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; transform: translate(0, 0) scale(1) rotate(0deg); }
      }
      @keyframes morph-3 {
        0% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; transform: translate(0, 0) scale(1); }
        50% { border-radius: 65% 35% 60% 40% / 40% 60% 40% 60%; transform: translate(20px, 25px) scale(1.12) rotate(10deg); }
        100% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; transform: translate(0, 0) scale(1); }
      }
      @keyframes morph-4 {
        0% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; transform: translate(0, 0) scale(1); }
        50% { border-radius: 55% 45% 35% 65% / 60% 40% 60% 40%; transform: translate(-25px, -20px) scale(1.08) rotate(-15deg); }
        100% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; transform: translate(0, 0) scale(1); }
      }
      @keyframes morph-5 {
        0% { border-radius: 40% 60% 35% 65% / 50% 40% 60% 50%; transform: translate(0, 0) scale(1); }
        50% { border-radius: 60% 40% 65% 35% / 40% 60% 40% 60%; transform: translate(25px, -15px) scale(1.1) rotate(18deg); }
        100% { border-radius: 40% 60% 35% 65% / 50% 40% 60% 50%; transform: translate(0, 0) scale(1); }
      }

      @keyframes fluid-stream {
        0% { background-position: 0% 50%; }
        100% { background-position: 300% 50%; }
      }
      @keyframes perimeter-breathe {
        0% { opacity: 0.65; }
        100% { opacity: 1; }
      }
      @keyframes pill-enter {
        from { opacity: 0; transform: translateY(-12px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes halo-breathe {
        0%, 100% { transform: scale(0.9); opacity: 0.5; }
        50% { transform: scale(1.25); opacity: 0.9; }
      }
      @keyframes sparkle-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes bar-wave {
        0%, 100% { transform: scaleY(0.4); opacity: 0.6; }
        50% { transform: scaleY(1.25); opacity: 1; }
      }
      @keyframes pop {
        from { transform: scale(0.7); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .blob, .stream, .sparkle-icon, .bars span, .orb-halo {
          animation: none !important;
        }
      }
    </style>
    <div class="wrap">
      <div class="veil"></div>
      <div class="perimeter"></div>
      <div class="stream"></div>

      <!-- Full-DOM Organic Fluid Aurora Mesh (No Sweep) -->
      <div class="aurora-mesh">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="blob blob-3"></div>
        <div class="blob blob-4"></div>
        <div class="blob blob-5"></div>
      </div>

      <div class="pill">
        <div class="orb-wrap">
          <div class="orb-halo"></div>
          <div class="orb-core">
            <svg class="sparkle-icon" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="url(#ija-ai-grad)"/>
              <defs>
                <linearGradient id="ija-ai-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#818cf8"/>
                  <stop offset="0.5" stop-color="#c084fc"/>
                  <stop offset="1" stop-color="#38bdf8"/>
                </linearGradient>
              </defs>
            </svg>
            <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
        </div>
        <span class="label"></span>
        <div class="bars">
          <span></span><span></span><span></span>
        </div>
        <span class="tag">IJA</span>
      </div>
    </div>`;
  root.querySelector('.label')!.textContent = label;
  document.documentElement.appendChild(host);
  // Never leave the overlay behind if the side panel closes mid-way.
  const timer = window.setTimeout(() => host.remove(), 120_000);
  w.__ijaScan = { root, timer, startedAt: Date.now() };
}

function finishScan(ok: boolean, label: string): void {
  const w = window as unknown as { __ijaScan?: { root: ShadowRoot; timer: number; startedAt: number; finishing?: boolean } };
  const host = document.getElementById('ija-scan-overlay');
  const state = w.__ijaScan;
  if (!host || !state) return;
  state.finishing = true;
  window.clearTimeout(state.timer);
  // Brief minimum display time so transitions look smooth
  const wait = Math.max(0, 500 - (Date.now() - state.startedAt));
  window.setTimeout(() => {
    const wrap = state.root.querySelector('.wrap')!;
    wrap.classList.add(ok ? 'done' : 'error');
    state.root.querySelector('.label')!.textContent = label;
    window.setTimeout(() => wrap.classList.add('leaving'), 800);
    window.setTimeout(() => {
      host.remove();
      if (w.__ijaScan === state) delete w.__ijaScan;
    }, 1350);
  }, wait);
}

/** Animated "scanning" overlay on the page, shown while IJA reads or fills it. Failures are ignored. */
export const pageOverlay = {
  async show(tabId: number, label: string): Promise<void> {
    await browser.scripting.executeScript({ target: { tabId }, func: showScan, args: [label] }).catch(() => undefined);
  },
  async finish(tabId: number, ok: boolean, label: string): Promise<void> {
    await browser.scripting.executeScript({ target: { tabId }, func: finishScan, args: [ok, label] }).catch(() => undefined);
  },
};
