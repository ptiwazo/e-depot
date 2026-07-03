import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api, ContainerManifest } from '../api';
import { Layout } from '../components';

const SIZE_TYPES = ['20DV', '20RF', '20OT', '20FR', '40DV', '40HC', '40HR', '40RF', '40OT', '40FR', '45HC'];

// Retrouve une colonne quel que soit son intitulé (insensible casse/accents).
function pick(row: Record<string, any>, keys: string[]): string {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  const wanted = keys.map(norm);
  for (const k of Object.keys(row)) {
    if (wanted.includes(norm(k))) return String(row[k] ?? '').trim();
  }
  return '';
}

export default function ManifestAdmin() {
  const [rows, setRows] = useState<ContainerManifest[]>([]);
  const [search, setSearch] = useState('');
  const [single, setSingle] = useState({ containerNumber: '', blNumber: '', containerType: '20DV', consignee: '', transporteur: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    api<ContainerManifest[]>(`/manifest${q}`).then(setRows);
  }
  useEffect(load, [search]);

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

  // Import d'un fichier .xlsx.
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(''); setMsg('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      const parsed = json
        .map((r) => ({
          containerNumber: pick(r, ['conteneur', 'container', 'container number', 'numero conteneur']),
          blNumber: pick(r, ['bl', 'blnumber', 'bl number', 'connaissement']),
          containerType: pick(r, ['type', 'sizetype', 'taille type', 'type taille']) || '20DV',
          consignee: pick(r, ['client', 'consignee', 'destinataire']),
          transporteur: pick(r, ['transporteur', 'transporter', 'carrier']),
        }))
        .filter((r) => r.containerNumber);
      if (!parsed.length) return setErr('Aucune ligne exploitable dans le fichier (colonnes attendues : Conteneur, BL, Type, Client).');
      const res = await api<{ imported: number; ignored: number; total: number; errors: string[] }>('/manifest/import', {
        method: 'POST',
        body: JSON.stringify({ rows: parsed }),
      });
      setMsg(`Import terminé : ${res.imported} importé(s), ${res.ignored} ignoré(s) sur ${res.total}.` + (res.errors.length ? ' ⚠ ' + res.errors.join(' | ') : ''));
      load();
    } catch (e: any) {
      setErr('Fichier illisible : ' + e.message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
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
            <label>Importer un fichier .xlsx</label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFile} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{rows.length} conteneur(s) dans la base</h2>
          <input style={{ width: 260 }} placeholder="Rechercher conteneur / BL…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <table>
          <thead>
            <tr><th>Conteneur</th><th>BL</th><th>Type</th><th>Ligne</th><th>Client</th><th>Transporteur</th><th></th></tr>
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
