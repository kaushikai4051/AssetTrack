import { useState, useRef, useCallback } from 'react'
import { Upload, Download, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/services/api'

// ── Column reference definitions per asset type ───────────────────────────────

const COLUMN_REFS = {
  fd: {
    endpoint: '/imports/fd',
    templateType: 'fd',
    label: 'Fixed Deposits',
    columns: [
      { name: 'bank_name',      required: true,  note: 'Name of the bank' },
      { name: 'account_number', required: false, note: 'FD account/certificate number (masked OK)' },
      { name: 'principal',      required: true,  note: 'Deposit amount in ₹' },
      { name: 'interest_rate',  required: true,  note: 'Annual interest rate, e.g. 7.00' },
      { name: 'compounding',    required: true,  note: 'monthly / quarterly / half_yearly / yearly / simple' },
      { name: 'start_date',     required: true,  note: 'YYYY-MM-DD format' },
      { name: 'maturity_date',  required: true,  note: 'YYYY-MM-DD format' },
      { name: 'is_auto_renew',  required: false, note: 'yes or no (default no)' },
      { name: 'nominee_name',   required: false, note: 'Nominee full name' },
      { name: 'notes',          required: false, note: 'Any remarks' },
    ],
  },
  ppf: {
    endpoint: '/imports/ppf',
    templateType: 'ppf',
    label: 'PPF Accounts',
    columns: [
      { name: 'account_number', required: true,  note: 'PPF account number — groups transactions per account' },
      { name: 'institution',    required: false, note: 'Bank or post office name' },
      { name: 'start_date',     required: false, note: 'Account opening date YYYY-MM-DD' },
      { name: 'interest_rate',  required: false, note: 'Current rate, e.g. 7.10' },
      { name: 'nominee',        required: false, note: 'Nominee name' },
      { name: 'tx_date',        required: true,  note: 'Transaction date YYYY-MM-DD' },
      { name: 'tx_type',        required: true,  note: 'deposit / withdrawal / interest' },
      { name: 'amount',         required: true,  note: 'Transaction amount in ₹' },
      { name: 'description',    required: false, note: 'Transaction remarks' },
    ],
  },
  'mutual-fund': {
    endpoint: '/imports/mutual-fund',
    templateType: 'mutual-fund',
    label: 'Mutual Funds',
    columns: [
      { name: 'scheme_name',  required: true,  note: 'Full fund name' },
      { name: 'scheme_code',  required: true,  note: 'MFAPI scheme code — groups transactions per fund+folio' },
      { name: 'isin',         required: false, note: 'ISIN code, e.g. INF846K01DP8' },
      { name: 'fund_house',   required: false, note: 'AMC name' },
      { name: 'category',     required: false, note: 'Equity / Debt / Hybrid etc.' },
      { name: 'plan_type',    required: false, note: 'growth or idcw (default growth)' },
      { name: 'folio_number', required: false, note: 'Folio number (same fund can have multiple folios)' },
      { name: 'tx_date',      required: true,  note: 'Transaction date YYYY-MM-DD' },
      { name: 'tx_type',      required: true,  note: 'purchase / redemption / dividend_reinvest / switch_in / switch_out' },
      { name: 'source',       required: false, note: 'sip / lumpsum / switch / dividend (default lumpsum)' },
      { name: 'units',        required: false, note: 'Units transacted (derived from amount/nav if omitted)' },
      { name: 'nav',          required: true,  note: 'NAV at transaction date' },
      { name: 'amount',       required: true,  note: 'Transaction value in ₹' },
      { name: 'notes',        required: false, note: 'Remarks' },
    ],
  },
}

// ── Simple CSV preview parser (browser-side, display only) ───────────────────

function parseCSVPreview(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return { headers: [], rows: [] }

  const splitRow = (line) => {
    const values = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"')        inQ = !inQ
      else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = '' }
      else cur += ch
    }
    values.push(cur.trim())
    return values
  }

  const headers = splitRow(lines[0]).map((h) => h.replace(/"/g, ''))
  const rows = lines.slice(1, 6).map(splitRow)   // preview first 5 data rows
  return { headers, rows, total: lines.length - 1 }
}

// ── Column reference panel ────────────────────────────────────────────────────

function ColumnReference({ config }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-md text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-left font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Column reference</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="px-4 pb-3 border-t">
          <table className="w-full mt-2 text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-1 pr-3 font-medium w-36">Column</th>
                <th className="text-left py-1 pr-3 font-medium w-16">Required</th>
                <th className="text-left py-1 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {config.columns.map((col) => (
                <tr key={col.name} className="border-t border-border/50">
                  <td className="py-1 pr-3 font-mono text-foreground">{col.name}</td>
                  <td className="py-1 pr-3">
                    {col.required
                      ? <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1">required</Badge>
                      : <Badge variant="outline" className="text-[10px] px-1">optional</Badge>}
                  </td>
                  <td className="py-1 text-muted-foreground">{col.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────

function StepUpload({ type, config, onFileReady }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileInfo, setFileInfo] = useState(null)
  const [preview, setPreview] = useState(null)

  const handleFile = useCallback((file) => {
    if (!file || !file.name.endsWith('.csv')) {
      alert('Please select a .csv file')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const parsed = parseCSVPreview(text)
      setFileInfo({ name: file.name, size: (file.size / 1024).toFixed(1) })
      setPreview(parsed)
      onFileReady(file)
    }
    reader.readAsText(file)
  }, [onFileReady])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get(`/imports/templates/${config.templateType}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${config.templateType}_import_template.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to download template. Please try again.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Download our template, fill it in, then upload it here.
        </p>
        <Button size="sm" variant="outline" onClick={handleDownloadTemplate}>
          <Download size={13} className="mr-1.5" />
          Download template
        </Button>
      </div>

      <ColumnReference config={config} />

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <Upload size={28} className="mx-auto mb-2 text-muted-foreground" />
        {fileInfo ? (
          <div>
            <p className="text-sm font-medium text-foreground">{fileInfo.name}</p>
            <p className="text-xs text-muted-foreground">{fileInfo.size} KB · {preview?.total} data rows detected</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium">Drop your CSV file here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          </div>
        )}
      </div>

      {/* Preview table */}
      {preview && preview.headers.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <div className="px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground border-b">
            Preview (first {preview.rows.length} of {preview.total} rows)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/20">
                  {preview.headers.map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-mono font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-t">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-1.5 whitespace-nowrap text-foreground">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 2: Confirm ───────────────────────────────────────────────────────────

function StepConfirm({ file, config, onResult }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleImport = async () => {
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post(config.endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onResult(res.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Import failed. Please check your file.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-md p-4 bg-muted/20 flex items-start gap-3">
        <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Ready to import</p>
          <p className="text-muted-foreground mt-0.5">
            <span className="font-mono text-foreground">{file.name}</span> will be validated
            and imported into your {config.label}. Valid rows are imported even if some fail.
          </p>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-md p-3 text-sm text-destructive flex items-start gap-2">
          <XCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <Button onClick={handleImport} disabled={loading} className="w-full">
        {loading ? 'Importing…' : `Import ${config.label}`}
      </Button>
    </div>
  )
}

// ── Step 3: Result ────────────────────────────────────────────────────────────

function StepResult({ result, onDone, onImportMore }) {
  const [showFailed, setShowFailed] = useState(false)
  const hasFailures = result.failed?.length > 0

  return (
    <div className="space-y-4">
      <div className={`rounded-md p-4 flex items-start gap-3 border ${
        result.imported > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
      }`}>
        {result.imported > 0
          ? <CheckCircle size={18} className="text-green-600 mt-0.5 shrink-0" />
          : <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
        }
        <div className="text-sm">
          <p className="font-medium">
            {result.imported > 0
              ? `${result.imported} record${result.imported !== 1 ? 's' : ''} imported successfully`
              : 'No records imported'}
          </p>
          {hasFailures && (
            <p className="text-muted-foreground mt-0.5">
              {result.failed.length} row{result.failed.length !== 1 ? 's' : ''} had errors and were skipped.
            </p>
          )}
        </div>
      </div>

      {hasFailures && (
        <div className="border rounded-md">
          <button
            type="button"
            onClick={() => setShowFailed((v) => !v)}
            className="flex items-center justify-between w-full px-4 py-2.5 text-left text-sm font-medium text-destructive"
          >
            <span>Failed rows ({result.failed.length})</span>
            {showFailed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showFailed && (
            <div className="border-t divide-y max-h-48 overflow-y-auto">
              {result.failed.map((f, i) => (
                <div key={i} className="px-4 py-2 text-xs flex items-start gap-3">
                  <span className="text-muted-foreground shrink-0 font-mono">Row {f.row}</span>
                  <span className="text-destructive">{f.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onImportMore}>
          Import another file
        </Button>
        <Button className="flex-1" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────────────────────

const STEP_LABELS = ['Upload', 'Confirm', 'Result']

export default function ImportWizard({ type, onDone }) {
  const config = COLUMN_REFS[type]
  if (!config) return null

  const [step, setStep] = useState(0)
  const [file, setFile]     = useState(null)
  const [result, setResult] = useState(null)

  const handleFileReady = (f) => {
    setFile(f)
  }

  const handleResult = (res) => {
    setResult(res)
    setStep(2)
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setStep(0)
  }

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold
              ${i < step ? 'bg-primary text-primary-foreground'
                : i === step ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'}`}
            >
              {i < step ? <CheckCircle size={13} /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'font-medium' : 'text-muted-foreground'}`}>{label}</span>
            {i < STEP_LABELS.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <div className="space-y-4">
          <StepUpload type={type} config={config} onFileReady={handleFileReady} />
          <Button
            className="w-full"
            disabled={!file}
            onClick={() => setStep(1)}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 1 && file && (
        <div className="space-y-4">
          <StepConfirm file={file} config={config} onResult={handleResult} />
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setStep(0)}>
            Back
          </Button>
        </div>
      )}

      {step === 2 && result && (
        <StepResult result={result} onDone={onDone} onImportMore={handleReset} />
      )}
    </div>
  )
}
