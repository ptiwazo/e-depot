/** Cycle de vie d'un rendez-vous et transitions autorisées. */

export const APPOINTMENT_STATUSES = [
  'REQUESTED',
  'VALIDATED',
  'ASSIGNED',
  'CONFIRMED',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'NO_SHOW',
  'CANCELLED',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

// Transitions autorisées de l'automate.
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  REQUESTED: ['VALIDATED', 'REJECTED', 'CANCELLED'],
  VALIDATED: ['ASSIGNED', 'REJECTED', 'CANCELLED'],
  ASSIGNED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ARRIVED', 'NO_SHOW', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatuses(from: AppointmentStatus): AppointmentStatus[] {
  return TRANSITIONS[from] ?? [];
}
