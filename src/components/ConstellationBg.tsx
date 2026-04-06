import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  pulse: number;
  pulseSpeed: number;
  color: string;
}

const COLORS = ['#ec4899', '#c8aa64', '#f472b6'];

export default function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];
    let time = 0;
    const CONNECT_DIST = 170;
    const COUNT = 90;
    let mouseX = -1000;
    let mouseY = -1000;

    // Floating radial blobs
    const blobs = [
      { x: 0.3, y: 0.25, color: 'rgba(236,72,153,0.06)', r: 0.35, speed: 0.3 },
      { x: 0.7, y: 0.6, color: 'rgba(200,170,100,0.05)', r: 0.3, speed: 0.4 },
      { x: 0.5, y: 0.8, color: 'rgba(244,114,182,0.05)', r: 0.32, speed: 0.25 },
    ];

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = canvas!.offsetWidth * dpr;
      canvas!.height = canvas!.offsetHeight * dpr;
    }

    function init() {
      resize();
      particles = [];
      for (let i = 0; i < COUNT; i++) {
        particles.push({
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 2 + 1,
          alpha: Math.random() * 0.4 + 0.2,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.02 + 0.005,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
    }

    function hexToRgb(hex: string) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    }

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      ctx!.clearRect(0, 0, w, h);
      time += 0.004;

      const dpr = window.devicePixelRatio || 1;
      const dist = CONNECT_DIST * dpr;

      // Draw floating radial blobs
      for (const blob of blobs) {
        const bx = (blob.x + Math.sin(time * blob.speed) * 0.08) * w;
        const by = (blob.y + Math.cos(time * blob.speed * 0.7) * 0.06) * h;
        const br = blob.r * Math.min(w, h);
        const grad = ctx!.createRadialGradient(bx, by, 0, bx, by, br);
        grad.addColorStop(0, blob.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx!.fillStyle = grad;
        ctx!.fillRect(0, 0, w, h);
      }

      // Update particles
      for (const p of particles) {
        p.x += p.vx + Math.sin(time * 1.2 + p.pulse) * 0.12 + Math.cos(time * 0.4) * 0.04;
        p.y += p.vy + Math.cos(time * 0.8 + p.pulse) * 0.1 + Math.sin(time * 0.3) * 0.03;
        p.pulse += p.pulseSpeed;

        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        const mdx = mouseX * dpr - p.x;
        const mdy = mouseY * dpr - p.y;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 180 * dpr && md > 0) {
          const force = (1 - md / (180 * dpr)) * 0.02;
          p.vx += (mdx / md) * force;
          p.vy += (mdy / md) * force;
        }

        p.vx *= 0.997;
        p.vy *= 0.997;
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 0.7) { p.vx *= 0.94; p.vy *= 0.94; }
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < dist) {
            const strength = 1 - d / dist;
            const alpha = strength * strength * 0.22;
            const c1 = hexToRgb(particles[i].color);
            const c2 = hexToRgb(particles[j].color);

            const grad = ctx!.createLinearGradient(
              particles[i].x, particles[i].y,
              particles[j].x, particles[j].y
            );
            grad.addColorStop(0, `rgba(${c1.r},${c1.g},${c1.b},${alpha})`);
            grad.addColorStop(1, `rgba(${c2.r},${c2.g},${c2.b},${alpha})`);

            ctx!.strokeStyle = grad;
            ctx!.lineWidth = (0.5 + strength * 1) * dpr;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      // Draw particles with glow
      for (const p of particles) {
        const pulseVal = Math.sin(p.pulse);
        const breathe = Math.sin(time * 2 + p.pulse) * 0.08;
        const pulseAlpha = p.alpha + pulseVal * 0.15 + breathe;
        const pulseR = p.r + pulseVal * 0.6;
        const c = hexToRgb(p.color);

        // Outer glow
        const glowSize = pulseR * 7 * dpr;
        const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        gradient.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${pulseAlpha * 0.3})`);
        gradient.addColorStop(0.35, `rgba(${c.r},${c.g},${c.b},${pulseAlpha * 0.1})`);
        gradient.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        ctx!.fillStyle = gradient;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx!.fill();

        // Core dot
        const coreSize = pulseR * dpr;
        const coreGrad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, coreSize);
        coreGrad.addColorStop(0, `rgba(${Math.min(255, c.r + 60)},${Math.min(255, c.g + 60)},${Math.min(255, c.b + 60)},${pulseAlpha + 0.35})`);
        coreGrad.addColorStop(0.5, `rgba(${c.r},${c.g},${c.b},${pulseAlpha + 0.18})`);
        coreGrad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        ctx!.fillStyle = coreGrad;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, coreSize * 1.6, 0, Math.PI * 2);
        ctx!.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const rect = canvas!.getBoundingClientRect();
      const touch = 'touches' in e ? e.touches[0] : e;
      if (touch) {
        mouseX = touch.clientX - rect.left;
        mouseY = touch.clientY - rect.top;
      }
    };

    const handleLeave = () => { mouseX = -1000; mouseY = -1000; };

    init();
    draw();
    window.addEventListener('resize', init);
    canvas.addEventListener('mousemove', handleMove as EventListener);
    canvas.addEventListener('mouseleave', handleLeave);
    canvas.addEventListener('touchmove', handleMove as EventListener, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', init);
      canvas.removeEventListener('mousemove', handleMove as EventListener);
      canvas.removeEventListener('mouseleave', handleLeave);
      canvas.removeEventListener('touchmove', handleMove as EventListener);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full z-0"
    />
  );
}
