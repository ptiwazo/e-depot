import { useEffect, useState } from 'react';
import { api, OffDock } from '../api';
import { Layout, OccupancyBar } from '../components';

const EMPTY = {
  code: '',
  name: '',
  city: '',
  lat: '',
  lng: '',
  dailyCapacity: '200',
  shiftCapacity: '60',
  parkingSlots: '10',
  acceptsReefer: true,
};

export default function OffDocks() {
  const [docks, setDocks] = useState<OffDock[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);

  function load() {
    api<OffDock[]>('/offdocks/load-today').then(setDocks);
  }
  useEffect(load, []);

  function set(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function useMyPosition() {
    setErr('');
    if (!navigator.geolocation) return setErr("La géolocalisation n'est pas disponible sur ce navigateur.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('lat', pos.coords.latitude.toFixed(6));
        set('lng', pos.coords.longitude.toFixed(6));
      },
      () => setErr('Impossible de récupérer la position GPS.'),
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (!form.code || !form.name || !form.city) return setErr('Code, nom et ville sont obligatoires.');
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng) || !form.lat || !form.lng) {
      return setErr('La position GPS (latitude / longitude) est obligatoire.');
    }
    setBusy(true);
    try {
      await api('/offdocks', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.toUpperCase().trim(),
          name: form.name,
          city: form.city,
          lat,
          lng,
          dailyCapacity: Number(form.dailyCapacity),
          shiftCapacity: Number(form.shiftCapacity),
          parkingSlots: Number(form.parkingSlots),
          acceptsReefer: form.acceptsReefer,
        }),
      });
      setMsg(`OFF-DOCK ${form.code.toUpperCase()} créé.`);
      setForm({ ...EMPTY });
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Enregistrement explicite d'une fiche (appelé par le bouton « Enregistrer »).
  async function save(id: string, data: Partial<OffDock>) {
    setMsg('');
    setErr('');
    await api(`/offdocks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    setMsg('Modifications enregistrées.');
    load();
  }

  return (
    <Layout title="Gestion des OFF-DOCKs">
      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert error">{err}</div>}

      <div className="card pad-lg" style={{ marginBottom: 18 }}>
        <h2>Créer un OFF-DOCK</h2>
        <form onSubmit={create}>
          <div className="row">
            <div className="field">
              <label>Code *</label>
              <input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="OD-ABOBO" />
            </div>
            <div className="field">
              <label>Nom *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="OFF-DOCK Abobo" />
            </div>
            <div className="field">
              <label>Ville *</label>
              <input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Abobo" />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Latitude GPS *</label>
              <input value={form.lat} onChange={(e) => set('lat', e.target.value)} placeholder="5.4321" />
            </div>
            <div className="field">
              <label>Longitude GPS *</label>
              <input value={form.lng} onChange={(e) => set('lng', e.target.value)} placeholder="-4.0123" />
            </div>
            <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="button" className="btn ghost" onClick={useMyPosition}>📍 Ma position actuelle</button>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Capacité / jour</label>
              <input type="number" value={form.dailyCapacity} onChange={(e) => set('dailyCapacity', e.target.value)} />
              <div className="small muted" style={{ marginTop: 4 }}>
                Nombre maximum de conteneurs vides que ce site peut recevoir sur <b>une journée entière</b> (tous shifts confondus). Sert au taux d'occupation quotidien et à l'équilibrage de la charge entre sites.
              </div>
            </div>
            <div className="field">
              <label>Capacité / shift</label>
              <input type="number" value={form.shiftCapacity} onChange={(e) => set('shiftCapacity', e.target.value)} />
              <div className="small muted" style={{ marginTop: 4 }}>
                Nombre maximum de conteneurs traitables sur <b>un seul poste horaire</b> (shift Jour ou Nuit). Évite de concentrer trop de rendez-vous sur le même créneau.
              </div>
            </div>
            <div className="field">
              <label>Capacité de parc (camions simultanés)</label>
              <input type="number" min="1" value={form.parkingSlots} onChange={(e) => set('parkingSlots', e.target.value)} />
              <div className="small muted" style={{ marginTop: 4 }}>
                Nombre de camions que le parc peut accueillir <b>en même temps</b> (places physiques). Sert au calcul <b>automatique</b> de la congestion : camions présents ÷ places.
              </div>
            </div>
          </div>

          <div className="flex between">
            <label style={{ margin: 0 }}>
              <input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={form.acceptsReefer} onChange={(e) => set('acceptsReefer', e.target.checked)} />
              Accepte les conteneurs REEFER
            </label>
            <button className="btn" disabled={busy}>{busy ? 'Création…' : 'Créer l\'OFF-DOCK'}</button>
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>
            La position GPS sert au moteur d'affectation (distance depuis le Port d'Abidjan).
          </div>
        </form>
      </div>

      <div className="grid cols-2">
        {docks.map((d) => (
          <OffDockCard key={d.id} dock={d} onSave={save} onError={setErr} />
        ))}
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// Fiche éditable avec validation explicite (Enregistrer / Annuler).
// ---------------------------------------------------------------------------
function draftFrom(d: OffDock) {
  return {
    code: d.code,
    name: d.name,
    city: d.city,
    dailyCapacity: String(d.dailyCapacity),
    shiftCapacity: String(d.shiftCapacity),
    parkingSlots: String(d.parkingSlots),
    lat: String(d.lat),
    lng: String(d.lng),
    acceptsReefer: d.acceptsReefer,
    active: d.active,
  };
}

function OffDockCard({
  dock,
  onSave,
  onError,
}: {
  dock: OffDock;
  onSave: (id: string, data: Partial<OffDock>) => Promise<void>;
  onError: (m: string) => void;
}) {
  const [draft, setDraft] = useState(() => draftFrom(dock));
  const [saving, setSaving] = useState(false);

  // Re-synchronise si la liste est rechargée depuis le serveur.
  useEffect(() => setDraft(draftFrom(dock)), [dock]);

  function upd(k: string, v: any) {
    setDraft((s) => ({ ...s, [k]: v }));
  }

  const dirty =
    draft.code !== dock.code ||
    draft.name !== dock.name ||
    draft.city !== dock.city ||
    Number(draft.dailyCapacity) !== dock.dailyCapacity ||
    Number(draft.shiftCapacity) !== dock.shiftCapacity ||
    Number(draft.parkingSlots) !== dock.parkingSlots ||
    Number(draft.lat) !== dock.lat ||
    Number(draft.lng) !== dock.lng ||
    draft.acceptsReefer !== dock.acceptsReefer ||
    draft.active !== dock.active;

  function validate(): string | null {
    if (!draft.code.trim() || !draft.name.trim() || !draft.city.trim()) return 'Code, nom et ville sont obligatoires.';
    if (Number(draft.dailyCapacity) < 1 || Number(draft.shiftCapacity) < 1 || Number(draft.parkingSlots) < 1)
      return 'Les capacités doivent être ≥ 1.';
    if (Number.isNaN(Number(draft.lat)) || Number.isNaN(Number(draft.lng))) return 'Coordonnées GPS invalides.';
    return null;
  }

  async function submit() {
    const v = validate();
    if (v) return onError(v);
    setSaving(true);
    try {
      await onSave(dock.id, {
        code: draft.code.toUpperCase().trim(),
        name: draft.name.trim(),
        city: draft.city.trim(),
        dailyCapacity: Number(draft.dailyCapacity),
        shiftCapacity: Number(draft.shiftCapacity),
        parkingSlots: Number(draft.parkingSlots),
        lat: Number(draft.lat),
        lng: Number(draft.lng),
        acceptsReefer: draft.acceptsReefer,
        active: draft.active,
      });
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const congestion = dock.congestion ?? 0;

  return (
    <div className="card" style={dirty ? { boxShadow: '0 0 0 2px var(--yellow-strong)' } : undefined}>
      <div className="flex between">
        <h2 style={{ margin: 0 }}>{dock.code}</h2>
        <div className="flex" style={{ gap: 8 }}>
          {dirty && <span className="badge IN_PROGRESS">Non enregistré</span>}
          <span className={`badge ${draft.active ? 'COMPLETED' : 'CANCELLED'}`}>{draft.active ? 'Actif' : 'Inactif'}</span>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <div>
          <label>Code</label>
          <input value={draft.code} onChange={(e) => upd('code', e.target.value.toUpperCase())} />
        </div>
        <div>
          <label>Nom</label>
          <input value={draft.name} onChange={(e) => upd('name', e.target.value)} />
        </div>
        <div>
          <label>Ville</label>
          <input value={draft.city} onChange={(e) => upd('city', e.target.value)} />
        </div>
      </div>

      <div style={{ margin: '14px 0' }}>
        <OccupancyBar pct={dock.occupancy ?? 0} />
        <div className="small muted">{dock.load}/{dock.dailyCapacity} conteneurs · {dock.occupancy}% du jour</div>
      </div>

      <div className="flex between" style={{ margin: '10px 0', padding: '8px 10px', background: 'var(--grey-100)', borderRadius: 8 }}>
        <div className="small">
          <b>Congestion (auto)</b>
          <div className="muted">{dock.onSite ?? 0} camion(s) présent(s) / {dock.parkingSlots} places de parc</div>
        </div>
        <span className={`badge ${congestion >= 0.7 ? 'REJECTED' : congestion >= 0.4 ? 'IN_PROGRESS' : 'COMPLETED'}`}>
          {Math.round(congestion * 100)}%
        </span>
      </div>

      <div className="row">
        <div>
          <label title="Conteneurs vides max reçus sur une journée entière (tous shifts confondus).">Capacité / jour ⓘ</label>
          <input type="number" value={draft.dailyCapacity} onChange={(e) => upd('dailyCapacity', e.target.value)} />
        </div>
        <div>
          <label title="Conteneurs max traitables sur un seul poste horaire (shift Jour ou Nuit).">Capacité / shift ⓘ</label>
          <input type="number" value={draft.shiftCapacity} onChange={(e) => upd('shiftCapacity', e.target.value)} />
        </div>
        <div>
          <label title="Camions accueillis simultanément (places physiques). Base du calcul automatique de la congestion.">Capacité de parc ⓘ</label>
          <input type="number" min="1" value={draft.parkingSlots} onChange={(e) => upd('parkingSlots', e.target.value)} />
        </div>
      </div>
      <div className="row">
        <div>
          <label>Latitude</label>
          <input value={draft.lat} onChange={(e) => upd('lat', e.target.value)} />
        </div>
        <div>
          <label>Longitude</label>
          <input value={draft.lng} onChange={(e) => upd('lng', e.target.value)} />
        </div>
      </div>

      <div className="flex between" style={{ marginTop: 10 }}>
        <div className="flex" style={{ gap: 14 }}>
          <label style={{ margin: 0 }}>
            <input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={draft.acceptsReefer} onChange={(e) => upd('acceptsReefer', e.target.checked)} />
            REEFER
          </label>
          <label style={{ margin: 0 }}>
            <input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={draft.active} onChange={(e) => upd('active', e.target.checked)} />
            Actif
          </label>
        </div>
        <div className="flex" style={{ gap: 8 }}>
          <button className="btn ghost sm" disabled={!dirty || saving} onClick={() => setDraft(draftFrom(dock))}>
            Annuler
          </button>
          <button className="btn sm" disabled={!dirty || saving} onClick={submit}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
