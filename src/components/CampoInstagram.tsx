import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'checking' | 'ok' | 'invalido' | 'nao_existe' | 'inconclusivo';

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  className?: string;
}

function normalizeLocal(s: string) {
  return (s || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/g, '')
    .split('/')[0]
    .split('?')[0]
    .toLowerCase();
}

function formatoValido(u: string) {
  if (!u || u.length < 1 || u.length > 30) return false;
  if (!/^[a-z0-9._]+$/.test(u)) return false;
  if (u.startsWith('.') || u.endsWith('.')) return false;
  if (u.includes('..')) return false;
  return true;
}

export function CampoInstagram({
  value,
  onChange,
  label = 'Instagram',
  placeholder = '@usuario',
  required,
  id = 'instagram',
  className,
}: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const debounceRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const user = normalizeLocal(value);
    if (!user) { setStatus('idle'); return; }
    if (!formatoValido(user)) { setStatus('invalido'); return; }
    setStatus('checking');
    const myId = ++reqIdRef.current;
    debounceRef.current = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verificar-instagram', {
          body: { usuario: user },
        });
        if (myId !== reqIdRef.current) return;
        if (error) { setStatus('inconclusivo'); return; }
        if (data?.status === 'formato_invalido') { setStatus('invalido'); return; }
        if (data?.exists === true) setStatus('ok');
        else if (data?.exists === false) setStatus('nao_existe');
        else setStatus('inconclusivo');
      } catch {
        if (myId === reqIdRef.current) setStatus('inconclusivo');
      }
    }, 600);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [value]);

  const borderClass =
    status === 'ok' ? 'border-green-500 focus-visible:ring-green-500' :
    status === 'invalido' || status === 'nao_existe' ? 'border-destructive focus-visible:ring-destructive' :
    '';

  return (
    <div className={cn('space-y-1', className)}>
      {label && <Label htmlFor={id}>{label}{required && ' *'}</Label>}
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn('pr-9', borderClass)}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {status === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {status === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {(status === 'invalido' || status === 'nao_existe') && <XCircle className="h-4 w-4 text-destructive" />}
          {status === 'inconclusivo' && <AlertCircle className="h-4 w-4 text-amber-500" />}
        </div>
      </div>
      {status === 'invalido' && (
        <p className="text-xs text-destructive">Formato inválido. Use letras, números, ponto e underline (sem espaços).</p>
      )}
      {status === 'nao_existe' && (
        <p className="text-xs text-destructive">Esse @ não foi encontrado no Instagram.</p>
      )}
      {status === 'inconclusivo' && (
        <p className="text-xs text-amber-600">Não foi possível confirmar agora — você pode salvar mesmo assim.</p>
      )}
      {status === 'ok' && (
        <p className="text-xs text-green-600">Perfil encontrado no Instagram.</p>
      )}
    </div>
  );
}