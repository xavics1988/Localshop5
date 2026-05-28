import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/** Verifica el JWT y devuelve el user ID. Lanza AuthError si no hay token o es inválido. */
export async function requireAuth(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new AuthError();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (error || !user) throw new AuthError();
  return user.id;
}

/**
 * Intenta obtener el user ID del JWT. Devuelve null si no hay cabecera.
 * Lanza AuthError si hay cabecera pero el token es inválido (evita suplantación parcial).
 */
export async function tryGetAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) throw new AuthError();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (error || !user) throw new AuthError();
  return user.id;
}

/** Error de autenticación — se traduce a HTTP 401. */
export class AuthError extends Error {
  readonly status = 401;
  constructor() {
    super('No autorizado');
    this.name = 'AuthError';
  }
}

/** Error de negocio visible para el cliente — se traduce a HTTP 400 (o el status indicado). */
export class UserFacingError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'UserFacingError';
    this.status = status;
  }
}

/** Construye la Response de error adecuada según el tipo de excepción. */
export function errorResponse(err: unknown, corsHeaders: Record<string, string>): Response {
  if (err instanceof AuthError) {
    return new Response(
      JSON.stringify({ error: 'No autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  if (err instanceof UserFacingError) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: err.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  // No filtrar detalles internos al cliente
  return new Response(
    JSON.stringify({ error: 'Error interno del servidor' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
