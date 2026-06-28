import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer, Download, AlertCircle, Wallet, TrendingUp, ShieldCheck, CreditCard, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import PageWrapper from '@/components/layout/PageWrapper'
import { formatINR, formatCompact } from '@/utils/currency'
import useAuthStore from '@/store/authStore'
import api from '@/services/api'

// ── Utilities ─────────────────────────────────────────────────────────────────

function buildFYOptions() {
  const now = new Date()
  const base = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return Array.from({ length: 5 }, (_, i) => {
    const y = base - i
    return `${y}-${String(y + 1).slice(-2)}`
  })
}

function generatedAt() {
  return new Date().toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function downloadCSV(filename, rows, reportTitle, user) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (v) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const meta = [
    `Application,AssetTrack`,
    `Report,"${reportTitle}"`,
    `Generated,"${generatedAt()}"`,
    `User,"${user?.full_name || ''} (${user?.email || ''})"`,
    ``,
  ]
  const dataRows = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ]
  const csv = [...meta, ...dataRows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function printSection(id, reportTitle, user) {
  const el = document.getElementById(id)
  if (!el) return
  const w = window.open('', '_blank')
  const header = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #6366f1;padding-bottom:12px;margin-bottom:20px">
      <div>
        <div style="font-size:22px;font-weight:700;color:#6366f1;letter-spacing:-0.5px">AssetTrack</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">Personal Finance &amp; Asset Management</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#64748b;line-height:1.6">
        <div><strong>${reportTitle}</strong></div>
        <div>${user?.full_name || ''}</div>
        <div>${user?.email || ''}</div>
        <div>Generated: ${generatedAt()}</div>
      </div>
    </div>`
  w.document.write(`<html><head><title>${reportTitle} — AssetTrack</title>
    <style>
      body{font-family:sans-serif;font-size:13px;color:#111;padding:24px;max-width:900px;margin:0 auto}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#f1f5f9;text-align:left;padding:6px 8px;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
      td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
      h2{margin-bottom:4px} .sub{color:#64748b;font-size:12px;margin-bottom:16px}
      .total{font-weight:600;background:#f8fafc}
      @media print{body{padding:16px}}
    </style>
  </head><body>${header}${el.innerHTML}</body></html>`)
  w.document.close()
  w.print()
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'networth', label: 'Net Worth', icon: Wallet },
  { key: 'capgains', label: 'Capital Gains', icon: TrendingUp },
  { key: 'income', label: 'Interest Income', icon: Receipt },
  { key: 'insurance', label: 'Insurance', icon: ShieldCheck },
  { key: 'loans', label: 'Loans', icon: CreditCard },
]

function TabBar({ active, onChange }) {
  return (
    <div className="flex gap-1 flex-wrap border-b border-border pb-0">
      {TABS.map((t) => {
        const Icon = t.icon
        const isActive = active === t.key
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <Icon size={15} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Action bar ────────────────────────────────────────────────────────────────

function Actions({ onPrint, onCSV, fyOptions, fy, onFYChange, user, reportTitle }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {fyOptions && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">FY</span>
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            value={fy}
            onChange={(e) => onFYChange(e.target.value)}
          >
            {fyOptions.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      )}
      <div className="flex gap-2 ml-auto">
        {onCSV && (
          <Button variant="outline" size="sm" onClick={() => onCSV(reportTitle, user)}>
            <Download size={14} className="mr-1" /> CSV
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => onPrint(reportTitle, user)}>
          <Printer size={14} className="mr-1" /> Print / PDF
        </Button>
      </div>
    </div>
  )
}

function ErrorState() {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
        <AlertCircle size={18} />
        <span>Could not load report. Make sure the server is running.</span>
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  return <div className="h-64 bg-muted rounded-lg animate-pulse" />
}

// ── Net Worth report ──────────────────────────────────────────────────────────

function NetWorthReport({ user }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'net-worth'],
    queryFn: () => api.get('/reports/net-worth').then((r) => r.data),
  })

  if (isError) return <ErrorState />
  if (isLoading) return <LoadingState />

  const csvRows = data.categories.flatMap((cat) =>
    cat.items.map((item) => ({
      Category: cat.name,
      'Asset Name': item.name,
      'Invested (₹)': item.invested,
      'Current Value (₹)': item.current,
      'Gain/Loss (₹)': item.current - item.invested,
    }))
  )

  return (
    <div className="space-y-4">
      <Actions
        reportTitle="Net Worth Snapshot"
        user={user}
        onPrint={(title, u) => printSection('nw-print', title, u)}
        onCSV={(title, u) => downloadCSV(`net-worth-${data.asOf}.csv`, csvRows, title, u)}
      />

      <div id="nw-print">
        <h2 className="text-base font-semibold mb-0.5">Net Worth Snapshot</h2>
        <p className="text-xs text-muted-foreground mb-4">As of {data.asOf}</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Total Assets', value: data.totalAssets, color: 'text-green-600' },
            { label: 'Total Liabilities', value: data.totalLiabilities, color: 'text-red-500' },
            { label: 'Net Worth', value: data.netWorth, color: 'text-primary font-bold' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.color}`}>{formatCompact(s.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          {data.categories.map((cat) => (
            <Card key={cat.name}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">{cat.name}</CardTitle>
                  <span className={`font-semibold text-sm ${cat.isLiability ? 'text-red-500' : ''}`}>
                    {formatCompact(cat.total)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-border bg-muted/40">
                      <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Asset</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Invested</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Current</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Gain/Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.items.map((item, i) => {
                      const gain = item.current - item.invested
                      return (
                        <tr key={i} className="border-t border-border">
                          <td className="px-4 py-2">{item.name}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{formatINR(item.invested)}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatINR(item.current)}</td>
                          <td className={`px-4 py-2 text-right text-xs ${gain >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {gain >= 0 ? '+' : ''}{formatINR(gain)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Capital Gains report ──────────────────────────────────────────────────────

function CapitalGainsReport({ user }) {
  const FY_OPTIONS = buildFYOptions()
  const [fy, setFY] = useState(FY_OPTIONS[0])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'capital-gains', fy],
    queryFn: () => api.get(`/tax/capital-gains?fy=${fy}`).then((r) => r.data),
  })

  if (isError) return <ErrorState />
  if (isLoading) return <LoadingState />

  const gains = data?.gains || []
  const tax = data?.tax || {}

  const csvRows = gains.map((g) => ({
    Asset: g.asset_name,
    Type: g.asset_type,
    'Buy Date': g.buy_date,
    'Sell Date': g.sell_date,
    'Buy Price (₹)': g.buy_price,
    'Sell Price (₹)': g.sell_price,
    Units: g.units,
    'Gain/Loss (₹)': g.gain,
    'Holding Days': g.holding_days,
    Category: g.gain_category,
  }))

  return (
    <div className="space-y-4">
      <Actions
        reportTitle={`Capital Gains — FY ${fy}`}
        user={user}
        fyOptions={FY_OPTIONS}
        fy={fy}
        onFYChange={setFY}
        onPrint={(title, u) => printSection('cg-print', title, u)}
        onCSV={gains.length ? (title, u) => downloadCSV(`capital-gains-${fy}.csv`, csvRows, title, u) : null}
      />

      <div id="cg-print">
        <h2 className="text-base font-semibold mb-0.5">Capital Gains Report — FY {fy}</h2>
        <p className="text-xs text-muted-foreground mb-4">For ITR filing (Schedule CG)</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Equity LTCG', value: tax.equity_ltcg ?? 0, note: '>1yr, >₹1L taxable @ 10%' },
            { label: 'Equity STCG', value: tax.equity_stcg ?? 0, note: '<1yr @ 15%' },
            { label: 'Debt Income', value: tax.debt_income ?? 0, note: 'At slab rate' },
            { label: 'Total CG Tax', value: tax.total_cg_tax ?? 0, note: 'Estimated', highlight: true },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-lg font-bold mt-0.5 ${s.highlight ? 'text-primary' : ''}`}>{formatINR(s.value)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {gains.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No realized gains for FY {fy}.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    {['Asset', 'Buy Date', 'Sell Date', 'Gain/Loss', 'Holding', 'Type'].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gains.map((g, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{g.asset_name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{g.buy_date}</td>
                      <td className="px-4 py-2 text-muted-foreground">{g.sell_date}</td>
                      <td className={`px-4 py-2 font-medium ${parseFloat(g.gain) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {parseFloat(g.gain) >= 0 ? '+' : ''}{formatINR(g.gain)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{g.holding_days}d</td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary" className="text-[10px]">{g.gain_category}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ── Interest Income report ────────────────────────────────────────────────────

function InterestIncomeReport({ user }) {
  const FY_OPTIONS = buildFYOptions()
  const [fy, setFY] = useState(FY_OPTIONS[0])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'interest-income', fy],
    queryFn: () => api.get(`/reports/interest-income?fy=${fy}`).then((r) => r.data),
  })

  if (isError) return <ErrorState />
  if (isLoading) return <LoadingState />

  const income = data?.income || []

  return (
    <div className="space-y-4">
      <Actions
        reportTitle={`Interest & Income — FY ${fy}`}
        user={user}
        fyOptions={FY_OPTIONS}
        fy={fy}
        onFYChange={setFY}
        onPrint={(title, u) => printSection('inc-print', title, u)}
        onCSV={income.length ? (title, u) => downloadCSV(`interest-income-${fy}.csv`, income.map((r) => ({
          Source: r.source, Type: r.type, Detail: r.detail, 'Amount (₹)': r.amount,
        })), title, u) : null}
      />

      <div id="inc-print">
        <h2 className="text-base font-semibold mb-0.5">Interest & Income Report — FY {fy}</h2>
        <p className="text-xs text-muted-foreground mb-4">FD interest, bond coupons, PPF interest, savings interest</p>

        <Card className="mb-3">
          <CardContent className="p-4 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Income</span>
            <span className="text-2xl font-bold text-primary">{formatINR(data.totalIncome ?? 0)}</span>
          </CardContent>
        </Card>

        {income.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No income data for FY {fy}.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    {['Source', 'Type', 'Detail', 'Amount'].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {income.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{r.source}</td>
                      <td className="px-4 py-2"><Badge variant="secondary" className="text-[10px]">{r.type}</Badge></td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{r.detail}</td>
                      <td className="px-4 py-2 font-semibold text-right">{formatINR(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// ── Insurance report ──────────────────────────────────────────────────────────

function InsuranceReport({ user }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'insurance'],
    queryFn: () => api.get('/reports/insurance').then((r) => r.data),
  })

  if (isError) return <ErrorState />
  if (isLoading) return <LoadingState />

  const csvRows = Object.entries(data.groups || {}).flatMap(([group, policies]) =>
    policies.map((p) => ({
      Group: group, Policy: p.name, Insurer: p.insurer, Type: p.type,
      'Cover (₹)': p.cover, 'Premium (₹)': p.premium, Mode: p.mode,
      'Start Date': p.startDate, 'Next Due': p.nextDueDate,
    }))
  )

  return (
    <div className="space-y-4">
      <Actions
        reportTitle="Insurance Coverage Summary"
        user={user}
        onPrint={(title, u) => printSection('ins-print', title, u)}
        onCSV={csvRows.length ? (title, u) => downloadCSV('insurance-summary.csv', csvRows, title, u) : null}
      />

      <div id="ins-print">
        <h2 className="text-base font-semibold mb-0.5">Insurance Coverage Summary</h2>
        <p className="text-xs text-muted-foreground mb-4">{data.policyCount} active policies</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Life Cover', value: data.totalLifeCover },
            { label: 'Health Cover', value: data.totalHealthCover },
            { label: 'Total Premium / yr', value: data.totalPremium },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold mt-1">{formatCompact(s.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {Object.entries(data.groups || {}).map(([group, policies]) => (
          <Card key={group} className="mb-3">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">{group} Insurance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-t border-border">
                    {['Policy', 'Insurer', 'Type', 'Cover', 'Premium/yr', 'Next Due'].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {policies.map((p, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.insurer}</td>
                      <td className="px-4 py-2"><Badge variant="secondary" className="text-[10px]">{p.type}</Badge></td>
                      <td className="px-4 py-2">{formatCompact(p.cover)}</td>
                      <td className="px-4 py-2">{formatINR(p.premium)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.nextDueDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ── Loans report ──────────────────────────────────────────────────────────────

function LoansReport({ user }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'loans'],
    queryFn: () => api.get('/reports/loans').then((r) => r.data),
  })

  if (isError) return <ErrorState />
  if (isLoading) return <LoadingState />

  const loans = data?.loans || []
  const csvRows = loans.map((l) => ({
    Loan: l.name, Lender: l.lender, Type: l.type,
    'Loan Amount (₹)': l.loanAmount, 'Rate %': l.interestRate,
    'EMI (₹)': l.emiAmount, 'EMIs Paid': l.emiCount,
    'Total Paid (₹)': l.totalPaid, 'Principal Paid (₹)': l.totalPrincipalPaid,
    'Interest Paid (₹)': l.totalInterestPaid, 'Outstanding (₹)': l.outstanding,
    Status: l.isClosed ? 'Closed' : 'Active',
  }))

  return (
    <div className="space-y-4">
      <Actions
        reportTitle="Loan Statement"
        user={user}
        onPrint={(title, u) => printSection('loan-print', title, u)}
        onCSV={loans.length ? (title, u) => downloadCSV('loan-statement.csv', csvRows, title, u) : null}
      />

      <div id="loan-print">
        <h2 className="text-base font-semibold mb-0.5">Loan Statement</h2>
        <p className="text-xs text-muted-foreground mb-4">EMI history and outstanding balances</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Total Outstanding', value: data.totalOutstanding },
            { label: 'Total Interest Paid', value: data.totalInterestPaid },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold mt-1">{formatINR(s.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No loans found.</p>
        ) : (
          <div className="space-y-3">
            {loans.map((loan, i) => (
              <Card key={i}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sm">{loan.name}</CardTitle>
                      <CardDescription className="text-xs">{loan.lender} · {loan.interestRate}% {loan.type}</CardDescription>
                    </div>
                    <Badge variant={loan.isClosed ? 'secondary' : 'outline'}>
                      {loan.isClosed ? 'Closed' : 'Active'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    {[
                      { label: 'Outstanding', value: formatINR(loan.outstanding) },
                      { label: 'EMIs Paid', value: `${loan.emiCount} of ${loan.tenureMonths}` },
                      { label: 'Interest Paid', value: formatINR(loan.totalInterestPaid) },
                      { label: 'Prepayments', value: formatINR(loan.prepayments) },
                    ].map((s) => (
                      <div key={s.label}>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="font-medium mt-0.5">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Reports() {
  const [tab, setTab] = useState('networth')
  const user = useAuthStore((s) => s.user)

  return (
    <PageWrapper title="Reports" description="Financial summaries ready for review and export">
      <TabBar active={tab} onChange={setTab} />

      <div className="mt-4">
        {tab === 'networth'  && <NetWorthReport user={user} />}
        {tab === 'capgains'  && <CapitalGainsReport user={user} />}
        {tab === 'income'    && <InterestIncomeReport user={user} />}
        {tab === 'insurance' && <InsuranceReport user={user} />}
        {tab === 'loans'     && <LoansReport user={user} />}
      </div>
    </PageWrapper>
  )
}
