import { SetMetadata } from '@nestjs/common';

export const ROLES = {
  ADMIN: 'ADMIN',
  AGENT: 'AGENT', // Agent d'exploitation MEDLOG (dispatch / affectation OFF-DOCK)
  OPERATOR: 'OPERATOR',
  TRANSPORTER: 'TRANSPORTER',
  DRIVER: 'DRIVER',
  MSC: 'MSC',
} as const;

export type Role = keyof typeof ROLES;

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
