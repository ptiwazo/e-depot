import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

const MUTATIONS = ['POST', 'PATCH', 'PUT', 'DELETE'];
const SENSITIVE = ['password', 'newpassword', 'confirm', 'token', 'motdepasse'];

// Nettoie le corps de requête pour le journal (jamais de mot de passe/jeton, valeurs tronquées).
function sanitize(body: any): any {
  if (body == null || typeof body !== 'object') return body;
  if (Array.isArray(body)) return `[${body.length} élément(s)]`;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (SENSITIVE.includes(k.toLowerCase())) { out[k] = '•••'; continue; }
    if (Array.isArray(v)) out[k] = `[${v.length} élément(s)]`;
    else if (v && typeof v === 'object') out[k] = '{…}';
    else if (typeof v === 'string' && v.length > 120) out[k] = v.slice(0, 120) + '…';
    else out[k] = v;
  }
  return out;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    if (!MUTATIONS.includes(req.method)) return next.handle();

    const path: string = req.originalUrl || req.url || '';
    // On ne journalise pas les tentatives de connexion (bruit + pas d'acteur).
    if (path.includes('/auth/login')) return next.handle();

    const record = (status: number) => {
      const entity = (path.replace(/^\/api\//, '').split(/[/?]/)[0] || 'root').toLowerCase();
      this.prisma.auditLog
        .create({
          data: {
            actorId: req.user?.id ?? null,
            action: req.method,
            entity,
            entityId: req.params?.id ?? null,
            meta: JSON.stringify({
              path,
              status,
              actor: req.user?.email ?? 'anonyme',
              role: req.user?.role ?? null,
              body: sanitize(req.body),
            }).slice(0, 2500),
          },
        })
        .catch(() => undefined);
    };

    return next.handle().pipe(
      tap({
        next: () => record(req.res?.statusCode ?? 200),
        error: (e) => record(e?.status ?? 500),
      }),
    );
  }
}
