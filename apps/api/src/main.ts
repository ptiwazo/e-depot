import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

const stripSlash = (s: string) => s.trim().replace(/\/+$/, '');

// Politique CORS robuste :
//   - CORS_ORIGIN absent ou "*"  → toutes origines autorisées (réponse reflète l'Origin).
//   - CORS_ORIGIN = liste séparée par des virgules → seules ces origines exactes,
//     en tolérant un slash final éventuel de part et d'autre.
function corsOptions(): CorsOptions {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw || raw === '*') return { origin: true, credentials: true };

  const allowed = raw.split(',').map(stripSlash).filter(Boolean);
  return {
    credentials: true,
    origin(origin, cb) {
      // Pas d'en-tête Origin (curl, appels serveur-à-serveur, /health) → autoriser.
      if (!origin || allowed.includes(stripSlash(origin))) return cb(null, true);
      cb(null, false);
    },
  };
}

async function bootstrap() {
  // bodyParser désactivé ici pour redéfinir la limite (défaut 100 Ko trop bas
  // pour l'import en masse de la base conteneurs → 413 "request entity too large").
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const bodyLimit = process.env.BODY_LIMIT || '25mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.setGlobalPrefix('api');
  app.enableCors(corsOptions());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🚛 e-depot API en écoute sur le port ${port} (préfixe /api)`);
}
bootstrap();
