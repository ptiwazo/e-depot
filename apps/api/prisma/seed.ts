import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { iso6346CheckDigit } from '../src/domain/container';
import { DEFAULT_SHIFTS, buildShift } from '../src/domain/assignment';

const prisma = new PrismaClient();
const PASSWORD = 'EDepot2026!';

/** Construit un numéro de conteneur MSC ISO 6346 valide à partir d'un préfixe + 6 chiffres. */
function mscContainer(prefix: string, six: string): string {
  const first10 = `${prefix}${six}`;
  return `${first10}${iso6346CheckDigit(first10)}`;
}

async function main() {
  console.log('🌱 Seed e-depot…');

  // Purge (ordre dépendances).
  await prisma.appointmentEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.user.deleteMany();
  await prisma.transportCompany.deleteMany();
  await prisma.offDock.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.containerManifest.deleteMany();

  const hash = await bcrypt.hash(PASSWORD, 10);

  // --- Shifts (postes portuaires, horaires modifiables par l'admin) ---
  for (const s of DEFAULT_SHIFTS) {
    await prisma.shift.create({ data: { code: s.code, label: s.label, startTime: s.startTime, endTime: s.endTime, order: s.order } });
  }

  // --- OFF-DOCKs (zone portuaire d'Abidjan) ---
  const vridi = await prisma.offDock.create({
    data: { code: 'OD-VRIDI', name: 'OFF-DOCK Vridi', city: 'Vridi', lat: 5.263, lng: -4.005, dailyCapacity: 250, shiftCapacity: 90, parkingSlots: 12 },
  });
  const koumassi = await prisma.offDock.create({
    data: { code: 'OD-KOUMASSI', name: 'OFF-DOCK Koumassi', city: 'Koumassi', lat: 5.293, lng: -3.947, dailyCapacity: 180, shiftCapacity: 60, parkingSlots: 8 },
  });
  const yopougon = await prisma.offDock.create({
    data: { code: 'OD-YOP', name: 'OFF-DOCK Yopougon', city: 'Yopougon', lat: 5.345, lng: -4.083, dailyCapacity: 200, shiftCapacity: 70, parkingSlots: 10, acceptsReefer: false },
  });
  const pk24 = await prisma.offDock.create({
    data: { code: 'OD-PK24', name: 'OFF-DOCK PK24 Anyama', city: 'Anyama', lat: 5.494, lng: -4.052, dailyCapacity: 300, shiftCapacity: 100, parkingSlots: 15 },
  });
  const docks = [vridi, koumassi, yopougon, pk24];

  // --- Utilisateurs ---
  await prisma.user.create({
    data: { email: 'admin@medlog.ci', password: hash, name: 'Admin MEDLOG CI', role: 'ADMIN', phone: '+2250700000001' },
  });
  await prisma.user.create({
    data: { email: 'agent@medlog.ci', password: hash, name: 'Agent Exploitation MEDLOG', role: 'AGENT', phone: '+2250700000002' },
  });
  await prisma.user.create({
    data: { email: 'operateur.vridi@medlog.ci', password: hash, name: 'Opérateur Vridi', role: 'OPERATOR', offDockId: vridi.id },
  });
  await prisma.user.create({
    data: { email: 'msc@msc.com', password: hash, name: 'MSC Monitoring', role: 'MSC' },
  });

  // --- Société de transport + ressources + comptes ---
  const company = await prisma.transportCompany.create({
    data: { name: 'Ivoire Trans SARL', rccm: 'CI-ABJ-2019-B-12345', phone: '+2250701020304', email: 'contact@ivoiretrans.ci' },
  });
  const transporter = await prisma.user.create({
    data: { email: 'transporteur@ivoiretrans.ci', password: hash, name: 'Ivoire Trans (Exploitation)', role: 'TRANSPORTER', companyId: company.id },
  });
  await prisma.user.create({
    data: { email: 'chauffeur@ivoiretrans.ci', password: hash, name: 'Kouassi Yao', role: 'DRIVER', companyId: company.id },
  });

  // Camions / remorques / chauffeurs sont désormais saisis manuellement (échantillons pour le seed).
  const trucks = ['CI-1234-AB', 'CI-5678-CD', 'CI-9012-EF'];
  const trailers = ['RM-4001-CI', 'RM-4002-CI', 'RM-4003-CI'];
  const driversInfo = [
    { name: 'Kouassi Yao', phone: '+2250708112233' },
    { name: 'Traoré Ibrahim', phone: '+2250709445566' },
  ];

  // --- Rendez-vous d'exemple (statuts variés pour peupler les KPIs) ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const samples: { prefix: string; six: string; status: string; dockIdx: number; shift: string; type?: string }[] = [
    { prefix: 'MSCU', six: '100001', status: 'COMPLETED', dockIdx: 0, shift: 'JOUR' },
    { prefix: 'MEDU', six: '100002', status: 'COMPLETED', dockIdx: 0, shift: 'JOUR' },
    { prefix: 'MSCU', six: '100003', status: 'IN_PROGRESS', dockIdx: 1, shift: 'JOUR' },
    { prefix: 'MSDU', six: '100004', status: 'ARRIVED', dockIdx: 1, shift: 'JOUR' },
    { prefix: 'MSCU', six: '100005', status: 'CONFIRMED', dockIdx: 3, shift: 'NUIT' },
    { prefix: 'MEDU', six: '100006', status: 'CONFIRMED', dockIdx: 3, shift: 'NUIT' },
    { prefix: 'MSMU', six: '100007', status: 'ASSIGNED', dockIdx: 0, shift: 'NUIT' },
    { prefix: 'MSCU', six: '100008', status: 'ASSIGNED', dockIdx: 2, shift: 'JOUR' },
    { prefix: 'MEDU', six: '100009', status: 'NO_SHOW', dockIdx: 1, shift: 'JOUR' },
    { prefix: 'MSCU', six: '100010', status: 'COMPLETED', dockIdx: 3, shift: 'JOUR' },
    { prefix: 'MSZU', six: '100011', status: 'REJECTED', dockIdx: 0, shift: 'NUIT' },
    { prefix: 'MSCU', six: '100012', status: 'ASSIGNED', dockIdx: 3, shift: 'NUIT' },
    // Demandes en attente d'affectation par un agent MEDLOG (dockIdx ignoré) :
    { prefix: 'MEDU', six: '100013', status: 'VALIDATED', dockIdx: 0, shift: 'JOUR' },
    { prefix: 'MSCU', six: '100014', status: 'VALIDATED', dockIdx: 0, shift: 'NUIT' },
    { prefix: 'MSDU', six: '100015', status: 'VALIDATED', dockIdx: 0, shift: 'JOUR' },
  ];

  // --- Base conteneurs (ContainerManifest) chargée par l'admin ---
  // Toutes les demandes doivent y figurer + quelques conteneurs libres pour tester une soumission.
  const DRY_TYPES = ['20DV', '40HC', '45HC', '40DV'];
  const typeByContainer = new Map<string, string>();
  const manifestRows: { containerNumber: string; blNumber: string; containerType: string; consignee: string; transporteur: string }[] = [];
  samples.forEach((s, i) => {
    const containerNumber = mscContainer(s.prefix, s.six);
    const containerType = DRY_TYPES[i % DRY_TYPES.length]; // RDV seed = types secs (cohérence OFF-DOCK)
    typeByContainer.set(containerNumber, containerType);
    manifestRows.push({ containerNumber, blNumber: `MSCUBL${s.six}`, containerType, consignee: 'SIVOP CI', transporteur: 'IVOIRE TRANS' });
  });
  // Conteneurs libres (dans la base, aucun RDV) — pour tester une nouvelle demande transporteur.
  // Le dernier est un REEFER (40HR) pour illustrer le routage vers un OFF-DOCK reefer.
  const freeContainers = [
    { c: mscContainer('MSCU', '200001'), b: 'MSCUBL200001', t: '40HC' },
    { c: mscContainer('MEDU', '200002'), b: 'MSCUBL200002', t: '20DV' },
    { c: mscContainer('MSCU', '200003'), b: 'MSCUBL200003', t: '45HC' },
    { c: mscContainer('MSDU', '200004'), b: 'MSCUBL200004', t: '40DV' },
    { c: mscContainer('MSMU', '200005'), b: 'MSCUBL200005', t: '40HR' },
  ];
  for (const f of freeContainers) {
    manifestRows.push({ containerNumber: f.c, blNumber: f.b, containerType: f.t, consignee: 'NESTLE CI', transporteur: 'IVOIRE TRANS' });
  }

  for (const m of manifestRows) {
    await prisma.containerManifest.create({
      data: { containerNumber: m.containerNumber, blNumber: m.blNumber, containerType: m.containerType, consignee: m.consignee, transporteur: m.transporteur },
    });
  }
  console.log(`   Base conteneurs : ${manifestRows.length} entrées. Libre pour test : ${freeContainers[0].c} / ${freeContainers[0].b} (${freeContainers[0].t})`);

  let idx = 0;
  for (const s of samples) {
    const dock = docks[s.dockIdx];
    const shiftDef = DEFAULT_SHIFTS.find((x) => x.code === s.shift)!;
    const built = buildShift(today, shiftDef);
    const slotStart = built.start;
    const slotEnd = built.end;
    const containerNumber = mscContainer(s.prefix, s.six);
    const reference = `EDP-SEED-${String(++idx).padStart(3, '0')}`;

    const events: any[] = [
      { toStatus: 'REQUESTED', note: 'Demande créée', createdAt: new Date(slotStart.getTime() - 3600_000 * 24) },
    ];
    if (['VALIDATED', 'ASSIGNED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'NO_SHOW'].includes(s.status)) {
      if (s.status === 'REJECTED') {
        events.push({ fromStatus: 'REQUESTED', toStatus: 'REJECTED', note: 'Conteneur non conforme' });
      } else {
        events.push({ fromStatus: 'REQUESTED', toStatus: 'VALIDATED' });
        if (s.status !== 'VALIDATED') {
          events.push({ fromStatus: 'VALIDATED', toStatus: 'ASSIGNED', note: `Affecté à ${dock.code}` });
        }
      }
    }
    if (['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(s.status)) {
      events.push({ fromStatus: 'ASSIGNED', toStatus: 'CONFIRMED' });
    }
    if (s.status === 'NO_SHOW') {
      events.push({ fromStatus: 'CONFIRMED', toStatus: 'NO_SHOW', note: 'Absence au créneau' });
    }
    if (['ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(s.status)) {
      events.push({ fromStatus: 'CONFIRMED', toStatus: 'ARRIVED', createdAt: slotStart });
    }
    if (['IN_PROGRESS', 'COMPLETED'].includes(s.status)) {
      events.push({ fromStatus: 'ARRIVED', toStatus: 'IN_PROGRESS', createdAt: new Date(slotStart.getTime() + 5 * 60000) });
    }
    if (s.status === 'COMPLETED') {
      events.push({ fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', createdAt: new Date(slotStart.getTime() + 42 * 60000) });
    }

    // Un OFF-DOCK n'est présent qu'à partir de l'affectation (ASSIGNED+).
    const assigned = ['ASSIGNED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'].includes(s.status);

    await prisma.appointment.create({
      data: {
        reference,
        containerNumber,
        containerType: typeByContainer.get(containerNumber) || '20DV',
        isoValid: true,
        blNumber: `MSCUBL${s.six}`,
        companyId: company.id,
        truckPlate: trucks[idx % trucks.length],
        trailerPlate: trailers[idx % trailers.length],
        driverName: driversInfo[idx % driversInfo.length].name,
        driverPhone: driversInfo[idx % driversInfo.length].phone,
        offDockId: assigned ? dock.id : null,
        requestedDate: slotStart,
        shiftCode: s.status === 'REJECTED' ? null : s.shift,
        slotStart: assigned ? slotStart : null,
        slotEnd: assigned ? slotEnd : null,
        status: s.status,
        qrToken: assigned ? `seed-${idx}-${Math.random().toString(36).slice(2, 12)}` : null,
        createdById: transporter.id,
        events: { create: events },
      },
    });
  }

  console.log('✅ Seed terminé.');
  console.log('   Comptes démo (mot de passe commun : ' + PASSWORD + ')');
  console.log('   • admin@medlog.ci            (ADMIN)');
  console.log('   • operateur.vridi@medlog.ci  (OPERATOR — OFF-DOCK Vridi)');
  console.log('   • transporteur@ivoiretrans.ci (TRANSPORTER)');
  console.log('   • chauffeur@ivoiretrans.ci   (DRIVER)');
  console.log('   • msc@msc.com                (MSC — lecture seule)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
