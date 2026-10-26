import { pageProject } from '@/lib/auth/page';
import { latestSnapshot, riskEvents, riskTrend } from '@/lib/risk';
import { query } from '@/lib/db/pg';
import { Card, Empty, StatusChip, fmt, label } from '@/components/ui';
import { ExplainRisk } from '@/components/Explain';
import { FactorBars, TrendChart } from '@/components/RiskViews';
import { RadialGauge } from '@/components/viz/RadialGauge';
import { Pulse, pulseLevel } from '@/components/viz/Pulse';
import { RecalculateButton } from '@/components/RiskActions';

export default async function RiskPage({ params }: { params: Promise<{ id: string }> }) {
  const { access, project: p } = await pageProject((await params).id);
  const staff = access.isGuide || access.isReviewer || access.isAdmin;
  const snap = await latestSnapshot(p.project_id);
  if (!snap) return <Empty>{['approved', 'in_progress'].includes(p.status) ? 'No risk assessment yet.' : 'Risk is assessed once the project is approved.'}</Empty>;
  const [trend, events, history] = staff
    ? await Promise.all([
        riskTrend(p.project_id), riskEvents(p.project_id),
        query<{ risk_id: number; risk_score: string; risk_level: string; reason: string; calculated_at: string }>(
          `SELECT risk_id, risk_score, risk_level, reason, calculated_at FROM risk_assessments WHERE project_id = $1 ORDER BY calculated_at DESC, risk_id DESC LIMIT 10`, [p.project_id])])
    : [[], [], []];

  return (
    <div className="stagger space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-3 font-display font-medium">Current risk</h2>
          <div className="flex flex-col items-center">
            <RadialGauge value={Number(snap.risk_score)} level={snap.risk_level} size={200}><span className="mt-1 block"><StatusChip status={snap.risk_level} /></span></RadialGauge>
            <Pulse level={pulseLevel(snap.risk_level)} width={260} height={44} glow className="mt-2" />
          </div>
          <p className="mt-3 text-sm text-slate-700">{snap.reason}</p>
          <p className="mt-2 text-xs text-slate-400">Calculated {fmt(snap.calculated_at)}</p>
          {(access.isGuide || access.isAdmin) && ['approved', 'in_progress'].includes(p.status) && <div className="mt-3"><RecalculateButton projectId={p.project_id} /></div>}
        </Card>
        {staff && (
          <Card className="lg:col-span-2"><h2 className="mb-4 font-display font-medium">Why this score</h2><FactorBars breakdown={snap.breakdown} /></Card>
        )}
      </div>

      {staff && (
        <>
          <Card><h2 className="mb-2 font-medium">Trend</h2><TrendChart points={trend} /><p className="text-xs text-slate-500">One point per day (the day&apos;s highest score). Coloured bands mark low, moderate, high and critical.</p></Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-2 font-medium">Risk events</h2>
              {events.length === 0 ? <p className="text-sm text-slate-500">No events.</p> : (
                <ul className="divide-y text-sm">{events.map((e) => (
                  <li key={e.event_id} className="py-2"><div className="flex items-center justify-between gap-2"><span className="font-medium">{label(e.event_type)}</span>{e.resolved_at ? <span className="text-xs text-green-700">resolved {fmt(e.resolved_at)}</span> : <span className="text-xs font-medium text-red-600">open</span>}</div><div className="text-xs text-slate-500">{e.details} · raised {fmt(e.created_at)}</div></li>))}</ul>
              )}
            </Card>
            <Card>
              <h2 className="mb-2 font-medium">Recent assessments</h2>
              <ul className="divide-y text-sm">{history.map((h) => (
                <li key={h.risk_id} className="flex items-start justify-between gap-2 py-2"><div><div className="text-xs text-slate-500">{fmt(h.calculated_at)}</div><div className="line-clamp-2 text-slate-700">{h.reason}</div></div><div className="flex shrink-0 items-center gap-2"><span className="tabular-nums">{Number(h.risk_score).toFixed(1)}</span><StatusChip status={h.risk_level} /></div></li>))}</ul>
            </Card>
          </div>
        </>
      )}
      <ExplainRisk />
    </div>
  );
}
