/**
 * Ambient Background Particles & Embers Engine
 * Hotel Springs Restaurant
 *
 * Adds beautiful, lightweight floating ambient micro-particles, glowing embers,
 * shimmering stardust, subtle mouse physics, click spark bursts, and connecting
 * filaments to give the website a warm, luxurious, culinary aesthetic.
 */

(function () {
    'use strict';

    // Prevent duplicate initialization
    if (window.__HOTEL_PARTICLES_INITIALIZED__) return;
    window.__HOTEL_PARTICLES_INITIALIZED__ = true;

    // Check user preference for reduced motion
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let isEnabled = true;

    // Palette: warm amber, golden honey, glowing hearth spark, soft warm starlight
    const COLOR_PALETTES = [
        { r: 255, g: 159, b: 13 },   // Brand primary gold/amber (#ff9f0d)
        { r: 255, g: 195, b: 50 },   // Warm radiant gold
        { r: 255, g: 228, b: 130 },  // Champagne glow
        { r: 255, g: 245, b: 220 },  // Warm white sparkle
        { r: 245, g: 115, b: 35 }    // Warm culinary ember
    ];

    let canvas = null;
    let ctx = null;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrameId = null;
    let isPageVisible = !document.hidden;

    let particles = [];
    let clickSparks = [];

    // Mouse tracking with soft spring damping
    const mouse = {
        x: -9999,
        y: -9999,
        targetX: -9999,
        targetY: -9999,
        active: false,
        radius: 135
    };

    function injectStyles() {
        if (!document.getElementById('bg-particles-style')) {
            const style = document.createElement('style');
            style.id = 'bg-particles-style';
            style.textContent = `
                #bg-particles-canvas {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    pointer-events: none !important;
                    z-index: 0 !important;
                    opacity: 0.95;
                    display: block !important;
                }
                body {
                    position: relative;
                }
                /* Ensure main content layers sit naturally above the background canvas */
                header, main, footer, .page-shell, .container, section, .scroll {
                    position: relative;
                    z-index: 1;
                }
                header {
                    z-index: 10001 !important;
                }
                .scroll {
                    z-index: 999 !important;
                }
                /* Particles toggle button in footer */
                .particles-toggle-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(255, 159, 13, 0.08);
                    border: 1px solid rgba(255, 159, 13, 0.28);
                    color: var(--main-color, #ff9f0d);
                    font-size: 0.76rem;
                    font-weight: 600;
                    padding: 5px 12px;
                    border-radius: 9999px;
                    cursor: pointer;
                    transition: all 0.25s ease;
                    margin-top: 8px;
                    text-decoration: none;
                }
                .particles-toggle-btn:hover {
                    background: rgba(255, 159, 13, 0.2);
                    border-color: #ff9f0d;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 14px rgba(255, 159, 13, 0.25);
                }
                .particles-toggle-btn.is-disabled {
                    opacity: 0.55;
                    border-color: rgba(255, 255, 255, 0.15);
                    color: #9e9e9e;
                    background: rgba(255, 255, 255, 0.05);
                }
                .particles-toggle-btn i {
                    font-size: 0.95rem;
                }
            `;
            document.head.appendChild(style);
        }
    }

    function getOptimalParticleCount() {
        if (prefersReducedMotion) return 18;
        const w = window.innerWidth;
        if (w < 600) return 30;
        if (w < 1024) return 50;
        return 75;
    }

    class Particle {
        constructor(initialY) {
            this.reset(initialY !== undefined ? initialY : Math.random() * (height || 800));
        }

        reset(initialY) {
            this.x = Math.random() * (width || window.innerWidth);
            this.y = initialY !== undefined ? initialY : (height || window.innerHeight) + Math.random() * 20;
            
            // Radii between 0.8px and 2.7px for delicate micro-spark aesthetic
            this.radius = 0.85 + Math.random() * 1.85;
            
            // Subtle upward float & gentle horizontal drift
            const speedFactor = prefersReducedMotion ? 0.35 : 1;
            this.vx = (Math.random() - 0.5) * 0.4 * speedFactor;
            this.vy = -(0.2 + Math.random() * 0.6) * speedFactor;
            
            // Sine-wave sway
            this.swayAngle = Math.random() * Math.PI * 2;
            this.swaySpeed = 0.01 + Math.random() * 0.02;
            this.swayMagnitude = 0.25 + Math.random() * 0.5;

            // Twinkle / Pulse
            this.palette = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
            this.baseAlpha = 0.25 + Math.random() * 0.55;
            this.alpha = this.baseAlpha;
            this.pulseAngle = Math.random() * Math.PI * 2;
            this.pulseSpeed = 0.015 + Math.random() * 0.035;

            // Interactive velocity offset from mouse repulsion
            this.interactiveVx = 0;
            this.interactiveVy = 0;
        }

        update() {
            // Sway & upward movement
            this.swayAngle += this.swaySpeed;
            const currentSway = Math.sin(this.swayAngle) * this.swayMagnitude;

            // Dampen mouse interaction force
            this.interactiveVx *= 0.92;
            this.interactiveVy *= 0.92;

            // Apply movement
            this.x += this.vx + currentSway + this.interactiveVx;
            this.y += this.vy + this.interactiveVy;

            // Shimmering twinkle
            this.pulseAngle += this.pulseSpeed;
            this.alpha = Math.max(0.12, Math.min(0.92, this.baseAlpha + Math.sin(this.pulseAngle) * 0.24));

            // Gentle mouse proximity repulsion
            if (mouse.active && !prefersReducedMotion) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const dist = Math.hypot(dx, dy);

                if (dist < mouse.radius && dist > 1) {
                    const force = (1 - dist / mouse.radius) * 1.35;
                    const angle = Math.atan2(dy, dx);
                    this.interactiveVx += Math.cos(angle) * force * 0.85;
                    this.interactiveVy += Math.sin(angle) * force * 0.85;
                }
            }

            // Wrap around edges gracefully
            if (this.y < -20) {
                this.reset(height + 15);
            } else if (this.y > height + 30) {
                this.reset(-10);
            }

            if (this.x < -25) {
                this.x = width + 15;
            } else if (this.x > width + 25) {
                this.x = -15;
            }
        }

        draw() {
            const { r, g, b } = this.palette;
            
            // For larger particles (>1.6px), draw a soft radiant outer halo
            if (this.radius > 1.6) {
                const glow = ctx.createRadialGradient(
                    this.x, this.y, 0,
                    this.x, this.y, this.radius * 3.8
                );
                glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${this.alpha * 0.75})`);
                glow.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${this.alpha * 0.22})`);
                glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
                
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius * 3.8, 0, Math.PI * 2);
                ctx.fillStyle = glow;
                ctx.fill();
            }

            // Particle core
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${this.alpha})`;
            ctx.fill();
        }
    }

    // Mini spark burst on click/tap
    class ClickSpark {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.4 + Math.random() * 3.5;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.radius = 1.0 + Math.random() * 1.8;
            this.life = 1.0;
            this.decay = 0.022 + Math.random() * 0.024;
            this.palette = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= 0.94;
            this.vy = this.vy * 0.94 - 0.06; // soft upward drift
            this.life -= this.decay;
        }

        draw() {
            if (this.life <= 0) return;
            const { r, g, b } = this.palette;
            const currentAlpha = Math.max(0, this.life * 0.85);

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * Math.max(0.2, this.life), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${currentAlpha})`;
            ctx.fill();
        }
    }

    function initParticles() {
        const count = getOptimalParticleCount();
        particles = [];
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(Math.random() * height));
        }
    }

    function resize() {
        if (!canvas || !ctx) return;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        initParticles();
    }

    // Draw delicate connecting filaments between close particles
    function drawConnections() {
        const maxDist = 85;
        const count = particles.length;

        for (let i = 0; i < count; i++) {
            const p1 = particles[i];
            for (let j = i + 1; j < count; j++) {
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.hypot(dx, dy);

                if (dist < maxDist) {
                    const lineAlpha = (1 - dist / maxDist) * 0.15 * Math.min(p1.alpha, p2.alpha);
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(255, 175, 45, ${lineAlpha})`;
                    ctx.lineWidth = 0.75;
                    ctx.stroke();
                }
            }
        }
    }

    // Draw soft ambient cursor aura
    function drawMouseAura() {
        if (!mouse.active || prefersReducedMotion) return;
        
        const aura = ctx.createRadialGradient(
            mouse.x, mouse.y, 0,
            mouse.x, mouse.y, 115
        );
        aura.addColorStop(0, 'rgba(255, 159, 13, 0.055)');
        aura.addColorStop(0.5, 'rgba(255, 185, 50, 0.025)');
        aura.addColorStop(1, 'rgba(255, 159, 13, 0)');

        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 115, 0, Math.PI * 2);
        ctx.fillStyle = aura;
        ctx.fill();
    }

    function render() {
        if (!isEnabled || !isPageVisible || !ctx) {
            animationFrameId = null;
            return;
        }

        // Smooth mouse damping
        if (mouse.active) {
            mouse.x += (mouse.targetX - mouse.x) * 0.22;
            mouse.y += (mouse.targetY - mouse.y) * 0.22;
        }

        ctx.clearRect(0, 0, width, height);

        drawMouseAura();

        // Update & draw particles
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }

        // Connecting filaments
        if (!prefersReducedMotion) {
            drawConnections();
        }

        // Interactive click sparks
        for (let i = clickSparks.length - 1; i >= 0; i--) {
            const spark = clickSparks[i];
            spark.update();
            spark.draw();
            if (spark.life <= 0) {
                clickSparks.splice(i, 1);
            }
        }

        animationFrameId = requestAnimationFrame(render);
    }

    function startAnimation() {
        if (!animationFrameId && isEnabled && isPageVisible) {
            animationFrameId = requestAnimationFrame(render);
        }
    }

    function stopAnimation() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    function setupCanvas() {
        injectStyles();

        canvas = document.getElementById('bg-particles-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'bg-particles-canvas';
            canvas.setAttribute('aria-hidden', 'true');
            if (document.body) {
                document.body.insertBefore(canvas, document.body.firstChild);
            }
        }

        if (!canvas) return false;

        ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return false;

        resize();
        startAnimation();
        return true;
    }

    function bindEvents() {
        window.addEventListener('resize', () => {
            resize();
        }, { passive: true });

        window.addEventListener('mousemove', (e) => {
            mouse.targetX = e.clientX;
            mouse.targetY = e.clientY;
            if (!mouse.active) {
                mouse.x = e.clientX;
                mouse.y = e.clientY;
                mouse.active = true;
            }
        }, { passive: true });

        window.addEventListener('mouseleave', () => {
            mouse.active = false;
            mouse.x = -9999;
            mouse.y = -9999;
        });

        window.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length > 0) {
                const t = e.touches[0];
                mouse.targetX = t.clientX;
                mouse.targetY = t.clientY;
                mouse.x = t.clientX;
                mouse.y = t.clientY;
                mouse.active = true;
            }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (e.touches && e.touches.length > 0) {
                const t = e.touches[0];
                mouse.targetX = t.clientX;
                mouse.targetY = t.clientY;
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            setTimeout(() => {
                mouse.active = false;
            }, 600);
        });

        // Click spark burst
        window.addEventListener('click', (e) => {
            const count = prefersReducedMotion ? 4 : 8;
            for (let i = 0; i < count; i++) {
                clickSparks.push(new ClickSpark(e.clientX, e.clientY));
            }
            startAnimation();
        }, { passive: true });

        // Tab visibility management
        document.addEventListener('visibilitychange', () => {
            isPageVisible = !document.hidden;
            if (isPageVisible) {
                startAnimation();
            } else {
                stopAnimation();
            }
        });
    }

    function syncToggleButton() {
        const btns = document.querySelectorAll('.particles-toggle-btn');
        btns.forEach(btn => {
            if (isEnabled) {
                btn.classList.remove('is-disabled');
                btn.innerHTML = `<i class='bx bxs-magic-wand'></i> <span>Particles: On</span>`;
            } else {
                btn.classList.add('is-disabled');
                btn.innerHTML = `<i class='bx bx-magic-wand'></i> <span>Particles: Off</span>`;
            }
        });
    }

    function init() {
        if (!setupCanvas()) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setupCanvas();
                    bindEvents();
                    syncToggleButton();
                });
            }
            return;
        }
        bindEvents();

        // Bind any particles toggle button
        document.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('.particles-toggle-btn');
            if (targetBtn) {
                e.preventDefault();
                window.BackgroundParticles.toggle();
            }
        });

        syncToggleButton();
    }

    // Public API
    window.BackgroundParticles = {
        enable() {
            isEnabled = true;
            startAnimation();
            syncToggleButton();
        },
        disable() {
            isEnabled = false;
            stopAnimation();
            if (ctx && width && height) {
                ctx.clearRect(0, 0, width, height);
            }
            syncToggleButton();
        },
        toggle() {
            if (isEnabled) {
                this.disable();
            } else {
                this.enable();
            }
            return isEnabled;
        },
        burst(x, y, count = 10) {
            for (let i = 0; i < count; i++) {
                clickSparks.push(new ClickSpark(x, y));
            }
            startAnimation();
        },
        isEnabled() {
            return isEnabled;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
