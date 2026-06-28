import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Paperclip, Upload, Download, Trash2, FileText, Image,
  Loader2, AlertCircle, Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageWrapper from '@/components/layout/PageWrapper'
import api from '@/services/api'

const ASSET_TYPE_LABELS = {
  fixed_deposit: 'Fixed Deposit', recurring_deposit: 'Recurring Deposit',
  savings_account: 'Savings Account', mutual_fund: 'Mutual Fund',
  stock: 'Stock', gold: 'Gold', corporate_bond: 'Corporate Bond',
  gsec_bond: 'G-Sec', tax_free_bond: 'Tax-Free Bond',
  ppf: 'PPF', nps: 'NPS', epf: 'EPF', ssy: 'SSY', nsc: 'NSC',
  scss: 'SCSS', kvp: 'KVP', post_office: 'Post Office',
  life_insurance: 'Life Insurance', health_insurance: 'Health Insurance',
  vehicle_insurance: 'Vehicle Insurance', property: 'Property', reit: 'REIT',
}

const MIME_ICONS = {
  'application/pdf': FileText,
  'image/jpeg': Image,
  'image/jpg': Image,
  'image/png': Image,
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(str) {
  if (!str) return null
  return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function ExpiryBadge({ date }) {
  if (!date) return null
  const d = daysUntil(date)
  if (d < 0)   return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Expired</Badge>
  if (d <= 30) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Expires in {d}d</Badge>
  return <Badge variant="outline" className="text-[10px]">Expires {fmtDate(date)}</Badge>
}

function DeleteButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-[10px] text-destructive font-medium">Delete?</span>
        <Button size="sm" variant="destructive" className="h-5 px-1.5 text-[10px]" onClick={onConfirm}>Yes</Button>
        <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => setConfirming(false)}>No</Button>
      </span>
    )
  }
  return (
    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setConfirming(true)}>
      <Trash2 size={12} />
    </Button>
  )
}

export default function Documents() {
  const qc = useQueryClient()
  const fileRef = useRef(null)
  const expiryRef = useRef(null)
  const [filterType, setFilterType] = useState('all')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [sortBy, setSortBy] = useState('date')

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await api.get('/documents')
      return res.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const ALLOWED = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!ALLOWED.includes(file.type)) {
      setUploadError('Only PDF, JPG, and PNG files are allowed.')
      e.target.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be under 10 MB.')
      e.target.value = ''
      return
    }

    setUploadError(null)
    setUploading(true)

    const form = new FormData()
    form.append('file', file)

    const params = new URLSearchParams()
    const expiresAt = expiryRef.current?.value
    if (expiresAt) params.set('expires_at', expiresAt)

    try {
      await api.post(`/documents?${params}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      qc.invalidateQueries({ queryKey: ['documents'] })
      if (fileRef.current)   fileRef.current.value = ''
      if (expiryRef.current) expiryRef.current.value = ''
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(doc) {
    const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.file_name
    a.click()
    URL.revokeObjectURL(url)
  }

  // Derived types for filter tabs
  const presentTypes = [...new Set(docs.map((d) => d.asset_type).filter(Boolean))]

  let filtered = filterType === 'all' ? docs
    : filterType === 'general' ? docs.filter((d) => !d.asset_type)
    : docs.filter((d) => d.asset_type === filterType)

  if (sortBy === 'expiry') {
    filtered = [...filtered].sort((a, b) => {
      if (!a.expires_at && !b.expires_at) return 0
      if (!a.expires_at) return 1
      if (!b.expires_at) return -1
      return new Date(a.expires_at) - new Date(b.expires_at)
    })
  }

  const expiringSoon = docs.filter((d) => d.expires_at && daysUntil(d.expires_at) <= 30 && daysUntil(d.expires_at) >= 0)

  return (
    <PageWrapper title="Documents">
      <div className="space-y-4">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Files', value: docs.length },
            { label: 'Total Size', value: fmtSize(docs.reduce((s, d) => s + d.size_bytes, 0)) },
            { label: 'Expiring Soon', value: expiringSoon.length, warn: expiringSoon.length > 0 },
            { label: 'Asset Types', value: presentTypes.length },
          ].map((c) => (
            <Card key={c.label} className="border">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${c.warn ? 'text-amber-600' : ''}`}>{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upload + controls */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm">Upload Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
              <input
                ref={expiryRef}
                type="date"
                placeholder="Expiry date (optional)"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading
                  ? <><Loader2 size={13} className="mr-1.5 animate-spin" />Uploading…</>
                  : <><Upload size={13} className="mr-1.5" />Attach File</>}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">PDF, JPG, PNG · Max 10 MB · Expiry date optional (for insurance policies, property docs etc.)</p>
            {uploadError && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle size={12} /> {uploadError}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Filter + sort bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={13} className="text-muted-foreground shrink-0" />
          {[
            { key: 'all', label: 'All' },
            { key: 'general', label: 'General' },
            ...presentTypes.map((t) => ({ key: t, label: ASSET_TYPE_LABELS[t] || t })),
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                filterType === key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Sort:</span>
            {['date', 'expiry'].map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                  sortBy === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {s === 'date' ? 'Newest' : 'Expiry'}
              </button>
            ))}
          </div>
        </div>

        {/* Document list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
              <Paperclip size={28} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No documents found.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {filtered.map((doc) => {
                  const Icon = MIME_ICONS[doc.mime_type] || FileText
                  return (
                    <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Icon size={16} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{doc.file_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{fmtSize(doc.size_bytes)}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(doc.created_at)}</span>
                          {doc.asset_type && (
                            <>
                              <span className="text-xs text-muted-foreground">·</span>
                              <Badge variant="outline" className="text-[10px] py-0">
                                {ASSET_TYPE_LABELS[doc.asset_type] || doc.asset_type}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <ExpiryBadge date={doc.expires_at} />
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => handleDownload(doc)}>
                        <Download size={14} />
                      </Button>
                      <DeleteButton onConfirm={() => deleteMutation.mutate(doc.id)} />
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  )
}
