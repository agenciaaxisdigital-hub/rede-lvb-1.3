import { MessageCircle, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PHONE = '5562993885258';
const MESSAGE = encodeURIComponent('Olá! Preciso de ajuda com o sistema Rede Política.');

export default function FloatingSupportButton() {
  const navigate = useNavigate();

  const handleOpen = () => {
    window.open(`https://wa.me/${PHONE}?text=${MESSAGE}`, '_blank', 'noopener');
  };

  const handleConheca = () => {
    window.open('https://drafernandasarelli.com.br', '_blank', 'noopener');
  };

  const pillStyle = {
    background: 'rgba(236,72,153,0.12)',
    color: '#c06',
    backdropFilter: 'blur(8px)',
  };

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top,12px)+20px)] right-3 z-[9999] flex items-center gap-1.5">
      <button
        onClick={handleConheca}
        aria-label="Site"
        className="flex items-center gap-1 px-2.5 h-6 rounded-full text-[10px] font-medium transition-all active:scale-95 hover:opacity-90"
        style={pillStyle}
      >
        <Globe size={11} strokeWidth={2} />
        Site
      </button>
      <button
        onClick={handleOpen}
        aria-label="Suporte"
        className="flex items-center gap-1 px-2.5 h-6 rounded-full text-[10px] font-medium transition-all active:scale-95 hover:opacity-90"
        style={pillStyle}
      >
        <MessageCircle size={11} strokeWidth={2} />
        Suporte
      </button>
    </div>
  );
}
