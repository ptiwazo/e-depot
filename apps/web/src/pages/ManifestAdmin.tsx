import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api, ContainerManifest } from '../api';
import { Layout } from '../components';

const SIZE_TYPES = ['20DV', '20RF', '20OT', '20FR', '40DV', '40HC', '40HR', '40RF', '40OT', '40FR', '45HC'];

type ImportRow = { containerNumber: string; blNumber: string; containerType: string; consignee: string; transporteur: string };
const CHUNK = 500; // lignes envoyées par lot (jauge + évite les très gros payloads / requêtes longues)

// Retrouve une colonne quel que soit son intitulé (insensible casse/accents/ponctuation).
// partial=true : accepte aussi un intitulé qui CONTIENT le mot-clé (ex. « Nom du transporteur »).
function pick(row: Record<string, any>, keys: string[], partial = false): string {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  const wanted = keys.map(norm);
  const cols = Object.keys(row);
  // 1) correspondance exacte
  for (const k of cols) if (wanted.includes(norm(k))) return String(row[k] ?? '').trim();
  // 2) repli : l'intitulé contient un mot-clé (mot-clé d'au moins 4 lettres pour éviter les faux positifs)
  if (partial) {
    for (const k of cols) {
      const nk = norm(k);
      if (wanted.some((w) => w.length >= 4 && nk.includes(w))) return String(row[k] ?? '').trim();
    }
  }
  return '';
}

export default function ManifestAdmin() {
  const [rows, setRows] = useState<ContainerManifest[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ container: '', bl: '', type: '', client: '', transporteur: '' });
  const [single, setSingle] = useState({ containerNumber: '', blNumber: '', containerType: '20DV', consignee: '', transporteur: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [parsed, setParsed] = useState<ImportRow[]>([]); // lignes du fichier, prêtes à valider
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0); // % d'avancement de l'import
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v.trim()) qs.set(k, v.trim()); });
    const q = qs.toString();
    api<ContainerManifest[]>(`/manifest${q ? '?' + q : ''}`).then(setRows);
    api<{ count: number }>('/manifest/count').then((d) => setTotal(d.count));
  }
  // Rechargement (debounce) à chaque changement de filtre.
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function clearBase() {
    if (!confirm('Supprimer TOUS les conteneurs de la base ? Action irréversible.')) return;
    setErr(''); setMsg('');
    try {
      const res = await api<{ deleted: number }>('/manifest', { method: 'DELETE' });
      setMsg(`Base vidée : ${res.deleted} conteneur(s) supprimé(s).`);
      load();
    } catch (e: any) { setErr(e.message); }
  }

  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      await api('/manifest', { method: 'POST', body: JSON.stringify(single) });
      setMsg(`Conteneur ${single.containerNumber} ajouté à la base.`);
      setSingle({ containerNumber: '', blNumber: '', containerType: '20DV', consignee: '', transporteur: '' });
      load();
    } catch (e: any) { setErr(e.message); }
  }

  // Télécharge un modèle .xlsx prêt à remplir.
  function downloadTemplate() {
    const data = [
      ['Conteneur', 'BL', 'Type', 'Client', 'Transporteur'],
      ['MSCU6639870', 'MSCUBL200001', '40HC', 'NESTLE CI', 'IVOIRE TRANS'],
      ['MEDU1234562', 'MSCUBL200002', '40HR', 'SIVOP', 'SDV CI'],
      ['MSCU2000011', 'MSCUBL200003', '20DV', 'CARGILL', 'BOLLORE'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 8 }, { wch: 20 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Conteneurs');
    XLSX.writeFile(wb, 'template_base_conteneurs.xlsx');
  }

  // Étape 1 : lecture du fichier .xlsx (aperçu, PAS d'import — l'import se fait au clic sur Valider).
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(''); setMsg(''); setParsed([]); setFileName('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      const list: ImportRow[] = json
        .map((r) => ({
          containerNumber: pick(r, ['conteneur', 'container', 'container number', 'numero conteneur']),
          blNumber: pick(r, ['bl', 'blnumber', 'bl number', 'connaissement']),
          containerType: pick(r, ['type', 'sizetype', 'taille type', 'type taille']) || '20DV',
          consignee: pick(r, ['client', 'consignee', 'destinataire']),
          transporteur: pick(r, ['transporteur', 'transporter', 'carrier', 'transitaire'], true),
        }))
        .filter((r) => r.containerNumber);
      if (!list.length) {
        setErr('Aucune ligne exploitable dans le fichier (colonnes attendues : Conteneur, BL, Type, Client, Transporteur).');
        return;
      }
      const withT = list.filter((r) => r.transporteur).length;
      setParsed(list);
      setFileName(file.name);
      let m = `${list.length} ligne(s) détectée(s) dans « ${file.name} » — ${withT} avec transporteur.`;
      if (withT === 0) {
        m += ` ⚠ Colonne « transporteur » non reconnue. Colonnes trouvées dans le fichier : ${Object.keys(json[0] || {}).join(' · ')}.`;
      }
      m += ` Cliquez sur « Valider l'import » pour charger.`;
      setMsg(m);
    } catch (e: any) {
      setErr('Fichier illisible : ' + e.message);
    }
  }

  // Étape 2 : import réel, par lots, avec jauge de progression.
  async function runImport() {
    if (!parsed.length || importing) return;
    setErr(''); setMsg(''); setImporting(true); setProgress(0);
    let imported = 0, ignored = 0;
    const errors: string[] = [];
    try {
      for (let i = 0; i < parsed.length; i += CHUNK) {
        const chunk = parsed.slice(i, i + CHUNK);
        const res = await api<{ imported: number; ignored: number; total: number; errors: string[] }>('/manifest/import', {
          method: 'POST',
          body: JSON.stringify({ rows: chunk }),
        });
        imported += res.imported;
        ignored += res.ignored;
        if (errors.length < 20 && res.errors?.length) errors.push(...res.errors);
        setProgress(Math.round(Math.min(i + CHUNK, parsed.length) / parsed.length * 100));
      }
      setMsg(`Import terminé : ${imported} importé(s), ${ignored} ignoré(s) sur ${parsed.length}.` + (errors.length ? ' ⚠ ' + errors.slice(0, 20).join(' | ') : ''));
      setParsed([]); setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e: any) {
      setErr('Import interrompu : ' + e.message);
    } finally {
      setImporting(false);
    }
  }

  function cancelImport() {
    setParsed([]); setFileName(''); setMsg('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function remove(id: string, num: string) {
    if (!confirm(`Retirer ${num} de la base ?`)) return;
    await api(`/manifest/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <Layout title="Base conteneurs (retours MSC autorisés)">
      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert error">{err}</div>}

      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        <form className="card pad-lg" onSubmit={addOne}>
          <h2>Ajouter un conteneur</h2>
          <div className="row">
            <div className="field">
              <label>Conteneur *</label>
              <input className="mono" value={single.containerNumber} onChange={(e) => setSingle({ ...single, containerNumber: e.target.value.toUpperCase() })} placeholder="MSCU6639870" />
            </div>
            <div className="field">
              <label>BL *</label>
              <input className="mono" value={single.blNumber} onChange={(e) => setSingle({ ...single, blNumber: e.target.value.toUpperCase() })} placeholder="MSCUBL200001" />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Type (taille + type)</label>
              <input className="mono" list="sizetypes" value={single.containerType} onChange={(e) => setSingle({ ...single, containerType: e.target.value.toUpperCase() })} placeholder="40HC" />
              <datalist id="sizetypes">
                {SIZE_TYPES.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="field">
              <label>Client / destinataire</label>
              <input value={single.consignee} onChange={(e) => setSingle({ ...single, consignee: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Transporteur</label>
              <input value={single.transporteur} onChange={(e) => setSingle({ ...single, transporteur: e.target.value })} placeholder="IVOIRE TRANS" />
            </div>
          </div>
          <button className="btn">Ajouter à la base</button>
        </form>

        <div className="card pad-lg">
          <h2>Import Excel (.xlsx)</h2>
          <p className="small muted">
            Colonnes attendues : <b>Conteneur</b>, <b>BL</b>, <b>Type</b> (ex. 20DV, 40HC, 40HR, 45HC), <b>Client</b>, <b>Transporteur</b>.
            Les conteneurs déjà présents sont mis à jour.
          </p>
          <button type="button" className="btn ghost" onClick={downloadTemplate}>⬇ Télécharger le template Excel</button>
          <div style={{ marginTop: 12 }}>
            <label>Choisir un fichier .xlsx</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFile} disabled={importing} />
          </div>

          {/* Aperçu + bouton Valider (avant import) */}
          {parsed.length > 0 && !importing && (
            <div style={{ marginTop: 14 }}>
              <div className="flex" style={{ gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={runImport}>
                  ✓ Valider l'import ({parsed.length} ligne{parsed.length > 1 ? 's' : ''})
                </button>
                <button type="button" className="btn ghost sm" onClick={cancelImport}>Annuler</button>
              </div>
            </div>
          )}

          {/* Jauge de progression (pendant l'import) */}
          {importing && (
            <div style={{ marginTop: 16 }}>
              <div className="flex between small" style={{ marginBottom: 6 }}>
                <b>Import en cours…</b>
                <span className="mono">{progress}%</span>
              </div>
              <div className="bar" style={{ height: 14 }}>
                <span style={{ width: `${progress}%`, transition: 'width .2s' }} />
              </div>
              <p className="small muted" style={{ marginTop: 6 }}>
                Chargement de {parsed.length} conteneur(s)… merci de patienter, ne fermez pas la page.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0 }}>
            {rows.length} affiché(s){rows.length >= 500 ? ' (max 500 — affinez les filtres)' : ''} · {total} au total
          </h2>
          <div className="flex" style={{ gap: 8 }}>
            {Object.values(filters).some((v) => v) && (
              <button className="btn ghost sm" onClick={() => setFilters({ container: '', bl: '', type: '', client: '', transporteur: '' })}>
                Réinitialiser
              </button>
            )}
            <button className="btn danger sm" onClick={clearBase} disabled={!total}>🗑 Vider la base</button>
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Conteneur</th><th>BL</th><th>Type</th><th>Ligne</th><th>Client</th><th>Transporteur</th><th></th></tr>
            <tr>
              {(['container', 'bl', 'type'] as const).map((k) => (
                <th key={k}><input className="filter-in" placeholder="filtrer…" value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })} /></th>
              ))}
              <th />
              {(['client', 'transporteur'] as const).map((k) => (
                <th key={k}><input className="filter-in" placeholder="filtrer…" value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })} /></th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.containerNumber}</td>
                <td className="mono">{r.blNumber}</td>
                <td className="mono">{r.containerType}</td>
                <td>{r.shippingLine}</td>
                <td className="small">{r.consignee ?? '—'}</td>
                <td className="small">{r.transporteur ?? '—'}</td>
                <td className="right"><button className="btn sm danger" onClick={() => remove(r.id, r.containerNumber)}>Retirer</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">Base vide. Ajoutez ou importez des conteneurs.</td></tr>}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
