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
  hue: number; // slight color variation
}

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
    const CONNECT_DIST = 160;
    const COUNT = 65;
    let mouseX = -1000;
    let mouseY = -1000;

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
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.8 + 1,
          alpha: Math.random() * 0.35 + 0.25,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.015 + 0.005,
          hue: 330 + Math.random() * 30, // pink range 330-360
        });
      }
    }

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      ctx!.clearRect(0, 0, w, h);
      time += 0.003;

      const dpr = window.devicePixelRatio || 1;
      const dist = CONNECT_DIST * dpr;

      // Update particles
      for (const p of particles) {
        // Gentle organic drift using sine waves
        p.x += p.vx + Math.sin(time + p.pulse) * 0.08;
        p.y += p.vy + Math.cos(time * 0.7 + p.pulse) * 0.06;
        p.pulse += p.pulseSpeed;

        // Wrap around edges smoothly
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        // Mouse attraction (gentle pull, not repulsion)
        const mdx = mouseX * dpr - p.x;
        const mdy = mouseY * dpr - p.y;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 150 * dpr && md > 0) {
          p.vx += (mdx / md) * 0.015;
          p.vy += (mdy / md) * 0.015;
        }

        // Damping
        p.vx *= 0.998;
        p.vy *= 0.998;

        // Clamp speed
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 0.6) {
          p.vx *= 0.95;
          p.vy *= 0.95;
        }
      }

      // Draw connections with gradient lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < dist) {
            const strength = 1 - d / dist;
            const alpha = strength * strength * 0.18; // quadratic falloff for softer lines

            // Gradient line between two particle colors
            const grad = ctx!.createLinearGradient(
              particles[i].x, particles[i].y,
              particles[j].x, particles[j].y
            );
            grad.addColorStop(0, `hsla(${particles[i].hue}, 80%, 65%, ${alpha})`);
            grad.addColorStop(1, `hsla(${particles[j].hue}, 80%, 65%, ${alpha})`);

            ctx!.strokeStyle = grad;
            ctx!.lineWidth = (0.5 + strength * 0.8) * dpr;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        const pulseVal = Math.sin(p.pulse);
        const pulseAlpha = p.alpha + pulseVal * 0.12;
        const pulseR = p.r + pulseVal * 0.5;

        // Outer glow — larger, softer
        const glowSize = pulseR * 6 * dpr;
        const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        gradient.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${pulseAlpha * 0.25})`);
        gradient.addColorStop(0.4, `hsla(${p.hue}, 80%, 70%, ${pulseAlpha * 0.08})`);
        gradient.addColorStop(1, `hsla(${p.hue}, 80%, 70%, 0)`);
        ctx!.fillStyle = gradient;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx!.fill();

        // Core dot with bright center
        const coreSize = pulseR * dpr;
        const coreGrad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, coreSize);
        coreGrad.addColorStop(0, `hsla(${p.hue}, 90%, 85%, ${pulseAlpha + 0.3})`);
        coreGrad.addColorStop(0.5, `hsla(${p.hue}, 80%, 65%, ${pulseAlpha + 0.15})`);
        coreGrad.addColorStop(1, `hsla(${p.hue}, 80%, 65%, 0)`);
        ctx!.fillStyle = coreGrad;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, coreSize * 1.5, 0, Math.PI * 2);
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

    const handleLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

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
