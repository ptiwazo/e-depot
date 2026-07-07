import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { SettingsService } from '../settings/settings.service';

export type InsightLevel = 'crit' | 'warn' | 'info' | 'good';
export interface Insight {
  level: InsightLevel;
  title: string;
  detail: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger('AiService');

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly settings: SettingsService,
  ) {}

  /** Point d'entrée du dashboard IA : métriques + insights déterministes + synthèse LLM (si configurée). */
  async insights() {
    const data = await this.analytics.overview();
    const alerts = this.computeAlerts(data);
    const recommendations = this.computeRecommendations(data, alerts);
    const highlights = this.computeHighlights(data);

    const apiKey = (await this.settings.get('ai_api_key')).trim();
    const model = (await this.settings.get('ai_model')).trim() || 'claude-sonnet-5';
    let briefing: string | null = null;
    let briefingError: string | null = null;
    if (apiKey) {
      const res = await this.llmBriefing(apiKey, model, data, alerts, recommendations);
      briefing = res.text;
      briefingError = res.error;
    }

    return {
      generatedAt: new Date().toISOString(),
      configured: !!apiKey,
      model: apiKey ? model : null,
      metrics: {
        total: data.total,
        pendingAssignment: data.pendingAssignment,
        onSite: data.onSite,
        todayScheduled: data.todayScheduled,
        upcoming7d: data.upcoming7d,
        completionRate: data.completionRate,
        noShowRate: data.noShowRate,
        avgOccupancy: data.avgOccupancy,
        congestedDocks: data.congestedDocks,
        avgAssignMin: data.avgAssignMin,
        avgTurnaroundMin: data.avgTurnaroundMin,
      },
      alerts,
      recommendations,
      highlights,
      briefing,
      briefingError,
    };
  }

  // --- Moteur déterministe (fonctionne sans clé API) -----------------------

  private computeAlerts(d: any): Insight[] {
    const out: Insight[] = [];

    if (d.pendingAssignment >= 15) {
      out.push({ level: 'crit', title: `${d.pendingAssignment} demandes en attente d'affectation`, detail: "File d'affectation engorgée : risque de retard de traitement pour les transporteurs." });
    } else if (d.pendingAssignment >= 5) {
      out.push({ level: 'warn', title: `${d.pendingAssignment} demandes en attente d'affectation`, detail: "Pensez à traiter la file d'affectation OFF-DOCK." });
    }

    if (d.noShowRate >= 15) {
      out.push({ level: 'crit', title: `Taux d'absence élevé (${d.noShowRate}%)`, detail: "Beaucoup de rendez-vous non honorés : capacité gaspillée sur les créneaux." });
    } else if (d.noShowRate >= 5) {
      out.push({ level: 'warn', title: `Taux d'absence à surveiller (${d.noShowRate}%)`, detail: "Les no-show augmentent : renforcez les rappels aux transporteurs." });
    }

    const saturated = (d.offDocks || []).filter((s: any) => s.occupancy >= 90);
    for (const s of saturated) {
      out.push({ level: 'crit', title: `${s.code} saturé (${s.occupancy}%)`, detail: `${s.load}/${s.capacity} conteneurs planifiés aujourd'hui sur ${s.city}.` });
    }
    const high = (d.offDocks || []).filter((s: any) => s.occupancy >= 70 && s.occupancy < 90);
    for (const s of high) {
      out.push({ level: 'warn', title: `${s.code} en forte charge (${s.occupancy}%)`, detail: `Approche de la capacité quotidienne sur ${s.city}.` });
    }

    if (d.congestedDocks > 0) {
      out.push({ level: 'warn', title: `${d.congestedDocks} site(s) congestionné(s)`, detail: 'Congestion de parc ≥ 70 % (camions présents / places) — fluidité dégradée au portail.' });
    }

    if (d.avgAssignMin >= 180) {
      out.push({ level: 'warn', title: `Délai d'affectation lent (${d.avgAssignMin} min)`, detail: "Le temps entre la demande et l'affectation est élevé : traitez la file plus tôt." });
    }

    // Pic de charge à venir (jour nettement au-dessus de la moyenne).
    const peak = this.peakDay(d.upcomingTrend);
    if (peak) {
      out.push({ level: 'info', title: `Pic de charge prévu le ${peak.label} (${peak.count} RDV)`, detail: 'Anticipez les effectifs et la répartition sur les shifts ce jour-là.' });
    }

    return out;
  }

  private computeRecommendations(d: any, alerts: Insight[]): string[] {
    const recs: string[] = [];
    if (d.pendingAssignment > 0) {
      recs.push(`Traiter les ${d.pendingAssignment} demande(s) en attente dans la file d'affectation OFF-DOCK.`);
    }

    // Déséquilibre de charge entre sites → rééquilibrage.
    const docks = (d.offDocks || []).filter((s: any) => s.capacity > 0);
    if (docks.length >= 2) {
      const sorted = [...docks].sort((a, b) => b.occupancy - a.occupancy);
      const hi = sorted[0];
      const lo = sorted[sorted.length - 1];
      if (hi.occupancy - lo.occupancy >= 40) {
        recs.push(`Rééquilibrer la charge : ${hi.code} (${hi.occupancy}%) est bien plus chargé que ${lo.code} (${lo.occupancy}%). Orienter les prochaines affectations vers ${lo.code}.`);
      }
    }

    const peak = this.peakDay(d.upcomingTrend);
    if (peak) {
      recs.push(`Anticiper le pic du ${peak.label} (${peak.count} RDV) : renforcer les équipes ou étaler sur les deux shifts.`);
    }

    if (d.noShowRate >= 5) {
      recs.push("Réduire les no-show : activer/vérifier les notifications e-mail (paramétrage SMTP) pour les rappels de rendez-vous.");
    }

    if (!recs.length) {
      recs.push("Situation nominale : aucune action prioritaire détectée. Maintenir le suivi de la file d'affectation.");
    }
    return recs;
  }

  private computeHighlights(d: any): Insight[] {
    return [
      { level: 'good', title: `${d.completionRate}% de complétion`, detail: `${d.byStatus?.COMPLETED ?? 0} rendez-vous menés à terme sur ${d.total}.` },
      { level: 'info', title: `${d.todayScheduled} RDV planifiés aujourd'hui`, detail: `${d.onSite} camion(s) actuellement sur site.` },
      { level: 'info', title: `${d.upcoming7d} RDV à venir (7 jours)`, detail: `Occupation moyenne des sites : ${d.avgOccupancy}%.` },
    ];
  }

  private peakDay(trend: { date: string; count: number }[] | undefined) {
    if (!trend || !trend.length) return null;
    const total = trend.reduce((a, t) => a + t.count, 0);
    if (total === 0) return null;
    const avg = total / trend.length;
    const max = trend.reduce((m, t) => (t.count > m.count ? t : m), trend[0]);
    if (max.count >= 4 && max.count >= avg * 1.8) {
      const d = new Date(max.date + 'T00:00:00Z');
      return { label: d.toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit' }), count: max.count };
    }
    return null;
  }

  // --- Synthèse en langage naturel via l'API Claude ------------------------

  private async llmBriefing(
    apiKey: string,
    model: string,
    d: any,
    alerts: Insight[],
    recommendations: string[],
  ): Promise<{ text: string | null; error: string | null }> {
    const payload = {
      metriques: {
        total: d.total,
        en_attente_affectation: d.pendingAssignment,
        sur_site: d.onSite,
        planifies_aujourdhui: d.todayScheduled,
        a_venir_7j: d.upcoming7d,
        taux_completion_pct: d.completionRate,
        taux_no_show_pct: d.noShowRate,
        occupation_moyenne_pct: d.avgOccupancy,
        sites_congestionnes: d.congestedDocks,
        delai_affectation_min: d.avgAssignMin,
        traitement_moyen_min: d.avgTurnaroundMin,
      },
      off_docks: (d.offDocks || []).map((s: any) => ({ code: s.code, ville: s.city, occupation_pct: s.occupancy, congestion_pct: s.congestion })),
      tendance_7j_a_venir: d.upcomingTrend,
      top_transporteurs: d.topTransporters,
      alertes_detectees: alerts.map((a) => `[${a.level}] ${a.title}`),
    };

    const system =
      "Tu es l'analyste d'exploitation d'e-depot, le système de rendez-vous des conteneurs vides MSC vers les OFF-DOCK de MEDLOG Côte d'Ivoire. " +
      "À partir des données chiffrées fournies, rédige une synthèse opérationnelle en français, concise et actionnable pour un responsable d'exploitation. " +
      "Structure ta réponse en 3 parties courtes : « État général » (2-3 phrases), « Risques » (puces), « Actions prioritaires » (puces, classées par urgence). " +
      "Sois factuel, appuie-toi uniquement sur les données ; ne invente pas de chiffres. Reste sous 220 mots.";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 700,
          system,
          messages: [{ role: 'user', content: 'Données d\'exploitation actuelles (JSON) :\n' + JSON.stringify(payload, null, 2) }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const body = await res.text();
        return { text: null, error: `API Claude ${res.status} : ${body.slice(0, 200)}` };
      }
      const json: any = await res.json();
      const text = Array.isArray(json.content)
        ? json.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim()
        : null;
      return { text: text || null, error: text ? null : 'Réponse vide du modèle.' };
    } catch (e: any) {
      const error = e?.name === 'AbortError' ? 'Délai dépassé (30s).' : e?.message ?? 'erreur inconnue';
      this.logger.warn(`Synthèse IA échouée : ${error}`);
      return { text: null, error };
    }
  }
}
