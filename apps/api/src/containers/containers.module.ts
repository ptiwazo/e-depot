import { Global, Module } from '@nestjs/common';
import { CONTAINER_REPOSITORY } from './container.repository';
import { PrismaContainerRepository } from './prisma-container.repository';

// Fournit CONTAINER_REPOSITORY (source Prisma/PostgreSQL).
// @Global : injectable dans ManifestModule et AppointmentsModule sans import explicite.
@Global()
@Module({
  providers: [
    { provide: CONTAINER_REPOSITORY, useClass: PrismaContainerRepository },
  ],
  exports: [CONTAINER_REPOSITORY],
})
export class ContainersModule {}
