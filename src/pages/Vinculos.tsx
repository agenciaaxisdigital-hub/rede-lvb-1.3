import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminVinculos from '@/components/AdminVinculos';

export default function Vinculos() {
  const navigate = useNavigate();

  return (
    <div className="h-full bg-background overflow-y-auto overscroll-contain pb-8">
      <div className="h-[1.5px] gradient-header" />
      
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-muted active:scale-95 transition-all">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Vínculos da Rede</h1>
            <p className="text-[10px] text-muted-foreground">Gestão de hierarquia e indicações</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <AdminVinculos />
      </div>
    </div>
  );
}