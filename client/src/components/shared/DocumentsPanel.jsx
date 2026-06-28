import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Upload, Download, Trash2, FileText, Image, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/services/api'

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

export default function DocumentsPanel({ assetType, assetId }) {
  const qc = useQueryClient()
  const fileRef = useRef(null)
  const expiryRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const qKey = ['documents', assetType, assetId]

  const { data: docs = [], isLoading } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      const params = {}
      if (assetType) params.asset_type = assetType
      if (assetId)   params.asset_id   = assetId
      const res = await api.get('/documents', { params })
      return res.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
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
    if (assetType) params.set('asset_type', assetType)
    if (assetId)   params.set('asset_id', assetId)
    const expiresAt = expiryRef.current?.value
    if (expiresAt) params.set('expires_at', expiresAt)

    try {
      await api.post(`/documents?${params}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      qc.invalidateQueries({ queryKey: qKey })
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

  return (
    <div className="space-y-3">
      {/* Upload row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleUpload}
        />
        <input
          ref={expiryRef}
          type="date"
          placeholder="Expiry date (optional)"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading
            ? <><Loader2 size={13} className="mr-1.5 animate-spin" />Uploading…</>
            : <><Upload size={13} className="mr-1.5" />Attach File</>}
        </Button>
      </div>

      {uploadError && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle size={12} /> {uploadError}
        </p>
      )}

      {/* Document list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : docs.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-xs text-muted-foreground">
          <Paperclip size={14} /> No documents attached yet.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((doc) => {
            const Icon = MIME_ICONS[doc.mime_type] || FileText
            return (
              <li key={doc.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <Icon size={14} className="shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium">{doc.file_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {fmtSize(doc.size_bytes)} · {fmtDate(doc.created_at)}
                  </p>
                </div>
                <ExpiryBadge date={doc.expires_at} />
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handleDownload(doc)}>
                  <Download size={12} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(doc.id)}
                >
                  <Trash2 size={12} />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
