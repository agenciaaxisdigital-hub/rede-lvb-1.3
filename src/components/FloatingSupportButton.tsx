import { useState } from 'react';
import { MessageCircle, X, Headphones } from 'lucide-react';

const PHONE = '5562993885258';
const MESSAGE = encodeURIComponent('Olá! Preciso de ajuda com o sistema Rede Política.');

export default function FloatingSupportButton() {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    window.open(`https://wa.me/${PHONE}?text=${MESSAGE}`, '_blank', 'noopener');
  };

  return (
    <div
      className="fixed z-[9999] flex flex-col items-end gap-2"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
        right: '1rem',
      }}
    >
      {open && (
        <div
          className="rounded-2xl p-4 w-64 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            background: 'linear-gradient(160deg, rgba(255,255,255,0.92), rgba(255,240,245,0.85))',
            backdropFilter: 'blur(16px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
            border: '1.5px solid rgba(236,150,170,0.4)',
            boxShadow: '0 8px 32px rgba(236,72,153,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <p style={{ color: '#333', fontWeight: 700, fontSize: '13px' }}>
              Suporte & Ajuda
            </p>
            <button onClick={() => setOpen(false)} className="p-0.5 rounded-full hover:bg-pink-50 transition-colors">
              <X size={14} style={{ color: '#999' }} />
            </button>
          </div>
          <p style={{ color: '#666', fontSize: '11px', lineHeight: 1.5 }}>
            Precisa de ajuda? Nossa equipe está disponível para te atender.
          </p>
          <button
            onClick={handleOpen}
            className="mt-3 w-full h-9 rounded-xl font-semibold text-white text-xs transition-all active:scale-[0.97] hover:brightness-110 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #ec4899, #d4a054)',
              boxShadow: '0 3px 12px rgba(236,72,153,0.25)',
            }}
          >
            <Headphones size={14} strokeWidth={2.5} />
            Falar com o Suporte
          </button>
        </div>
      )}

      {/* Pill button like the reference image */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Suporte"
        className="flex items-center gap-2 px-4 h-10 rounded-full text-white font-semibold text-sm transition-all active:scale-95 hover:scale-105 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #ec4899, #d4a054)',
          boxShadow: '0 4px 20px rgba(236,72,153,0.35), 0 2px 8px rgba(200,170,100,0.2)',
        }}
      >
        {open ? <X size={16} strokeWidth={2.5} /> : <MessageCircle size={16} strokeWidth={2.5} />}
        Suporte/Ajuda
      </button>
    </div>
  );
}
