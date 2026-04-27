import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import type { InstagramStatus, TelefoneStatus } from '@/hooks/useInstagramCheck';

export function InstagramStatusIcon({ status }: { status: InstagramStatus }) {
  if (status === 'idle') return null;
  if (status === 'checking') return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === 'invalido' || status === 'nao_existe') return <XCircle className="h-4 w-4 text-destructive" />;
  // Inconclusivo (IP bloqueado pelo IG): mostra check verde já que o formato é válido
  return <CheckCircle2 className="h-4 w-4 text-green-600" />;
}

export function TelefoneStatusIcon({ status }: { status: TelefoneStatus }) {
  if (status === 'idle') return null;
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

export function instagramHelpText(status: InstagramStatus): string | null {
  if (status === 'invalido') return 'Formato inválido (use letras, números, ponto, underline).';
  if (status === 'nao_existe') return 'Esse @ não foi encontrado no Instagram.';
  // Inconclusivo é silencioso — o IP do servidor pode estar bloqueado pelo IG
  if (status === 'ok') return null;
  return null;
}

export function telefoneHelpText(status: TelefoneStatus): string | null {
  if (status === 'invalido') return 'Número inválido (DDD + 8 ou 9 dígitos).';
  return null;
}