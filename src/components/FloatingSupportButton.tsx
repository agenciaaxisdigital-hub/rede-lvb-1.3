import { MessageCircle } from 'lucide-react';

const PHONE = '5562993885258';
const MESSAGE = encodeURIComponent('Olá! Preciso de ajuda com o sistema Rede Política.');

export default function FloatingSupportButton() {
  const handleOpen = () => {
    window.open(`https://wa.me/${PHONE}?text=${MESSAGE}`, '_blank', 'noopener');
  };

  return (
    <button
      onClick={handleOpen}
      aria-label="Suporte"
      className="fixed top-3 right-3 z-[9999] flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-medium transition-all active:scale-95 hover:opacity-90"
      style={{
        background: 'rgba(236,72,153,0.12)',
        color: '#c06',
        backdropFilter: 'blur(8px)',
      }}
    >
      <MessageCircle size={12} strokeWidth={2} />
      Suporte
    </button>
  );
}
