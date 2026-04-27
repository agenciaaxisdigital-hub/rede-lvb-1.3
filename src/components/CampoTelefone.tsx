import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  className?: string;
}

function formatar(raw: string) {
  const d = (raw || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function validar(raw: string): 'idle' | 'ok' | 'invalido' {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length === 0) return 'idle';
  if (d.length < 10) return 'invalido';
  if (d.length > 11) return 'invalido';
  // DDD válido: 11-99 (não pode começar com 0)
  const ddd = parseInt(d.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return 'invalido';
  // Celular (11 dígitos) deve começar com 9 após o DDD
  if (d.length === 11 && d[2] !== '9') return 'invalido';
  // Fixo (10 dígitos) deve começar com 2-5 após o DDD
  if (d.length === 10 && !/[2-5]/.test(d[2])) return 'invalido';
  return 'ok';
}

export function CampoTelefone({
  value,
  onChange,
  label = 'WhatsApp',
  placeholder = '(00) 00000-0000',
  required,
  id = 'telefone',
  className,
}: Props) {
  const status = useMemo(() => validar(value), [value]);
  const display = useMemo(() => formatar(value), [value]);

  const borderClass =
    status === 'ok' ? 'border-green-500 focus-visible:ring-green-500' :
    status === 'invalido' ? 'border-destructive focus-visible:ring-destructive' :
    '';

  return (
    <div className={cn('space-y-1', className)}>
      {label && <Label htmlFor={id}>{label}{required && ' *'}</Label>}
      <div className="relative">
        <Input
          id={id}
          value={display}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode="tel"
          autoComplete="tel"
          className={cn('pr-9', borderClass)}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {status === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {status === 'invalido' && <XCircle className="h-4 w-4 text-destructive" />}
        </div>
      </div>
      {status === 'invalido' && (
        <p className="text-xs text-destructive">Número inválido. Use DDD + 8 ou 9 dígitos (ex.: (62) 99999-9999).</p>
      )}
    </div>
  );
}