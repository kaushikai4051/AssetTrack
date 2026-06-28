import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  User, Lock, Info, CheckCircle, AlertCircle, Eye, EyeOff,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PageWrapper from '@/components/layout/PageWrapper'
import useAuthStore from '@/store/authStore'
import api from '@/services/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function Toast({ message, type }) {
  if (!message) return null
  const isError = type === 'error'
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
      isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
    }`}>
      {isError ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
      {message}
    </div>
  )
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-primary" />
      </div>
      <div>
        <h2 className="font-semibold text-sm">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection({ profile }) {
  const [toast, setToast] = useState(null)
  const login = useAuthStore((s) => s.login)
  const accessToken = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm({
    defaultValues: {
      full_name: profile.full_name || '',
      dob: profile.dob ? String(profile.dob).slice(0, 10) : '',
      risk_profile: profile.risk_profile || '',
      pan: profile.pan || '',
      base_currency: profile.base_currency || 'INR',
    },
  })

  // Sync form if profile reloads
  useEffect(() => {
    reset({
      full_name: profile.full_name || '',
      dob: profile.dob ? String(profile.dob).slice(0, 10) : '',
      risk_profile: profile.risk_profile || '',
      pan: profile.pan || '',
      base_currency: profile.base_currency || 'INR',
    })
  }, [profile.full_name, profile.dob, profile.risk_profile, profile.pan, profile.base_currency, reset])

  const mutation = useMutation({
    mutationFn: (data) => api.put('/auth/profile', data).then((r) => r.data),
    onSuccess: (data) => {
      setToast({ message: 'Profile updated successfully', type: 'success' })
      // Update auth store so header name refreshes
      login(data.user, accessToken)
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      setTimeout(() => setToast(null), 3000)
    },
    onError: (err) => {
      setToast({ message: err.response?.data?.message || 'Update failed', type: 'error' })
    },
  })

  return (
    <Card>
      <CardContent className="pt-6">
        <SectionHeader icon={User} title="Profile" description="Your personal details and preferences" />

        {toast && <div className="mb-4"><Toast {...toast} /></div>}

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                {...register('full_name', { required: 'Name is required' })}
                placeholder="Your full name"
              />
              {errors.full_name && <p className="text-xs text-red-500">{errors.full_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" type="date" {...register('dob')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="risk_profile">Risk Profile</Label>
              <select
                id="risk_profile"
                {...register('risk_profile')}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Select —</option>
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pan">PAN</Label>
              <Input
                id="pan"
                {...register('pan', {
                  pattern: { value: /^[A-Z]{5}[0-9]{4}[A-Z]$/i, message: 'Invalid PAN format' },
                })}
                placeholder="ABCDE1234F"
                maxLength={10}
                className="uppercase"
              />
              {errors.pan && <p className="text-xs text-red-500">{errors.pan.message}</p>}
              {profile.pan_masked && !errors.pan && (
                <p className="text-xs text-muted-foreground">Stored: {profile.pan_masked}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="base_currency">Base Currency</Label>
              <select
                id="base_currency"
                {...register('base_currency')}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="INR">INR — Indian Rupee</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={!isDirty || mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Change password section ───────────────────────────────────────────────────

function SecuritySection() {
  const [toast, setToast] = useState(null)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const { register, handleSubmit, formState: { errors }, watch, reset } = useForm()
  const newPwd = watch('new_password', '')

  const mutation = useMutation({
    mutationFn: (data) => api.put('/auth/change-password', data).then((r) => r.data),
    onSuccess: () => {
      setToast({ message: 'Password changed successfully', type: 'success' })
      reset()
      setTimeout(() => setToast(null), 3000)
    },
    onError: (err) => {
      setToast({ message: err.response?.data?.message || 'Password change failed', type: 'error' })
    },
  })

  return (
    <Card>
      <CardContent className="pt-6">
        <SectionHeader icon={Lock} title="Security" description="Change your account password" />

        {toast && <div className="mb-4"><Toast {...toast} /></div>}

        <form
          onSubmit={handleSubmit((d) => mutation.mutate({ current_password: d.current_password, new_password: d.new_password }))}
          className="space-y-4 max-w-sm"
        >
          <div className="space-y-1.5">
            <Label htmlFor="current_password">Current Password</Label>
            <div className="relative">
              <Input
                id="current_password"
                type={showCurrent ? 'text' : 'password'}
                {...register('current_password', { required: 'Required' })}
                placeholder="Current password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.current_password && <p className="text-xs text-red-500">{errors.current_password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new_password">New Password</Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showNew ? 'text' : 'password'}
                {...register('new_password', {
                  required: 'Required',
                  minLength: { value: 8, message: 'Minimum 8 characters' },
                })}
                placeholder="New password (min 8 chars)"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.new_password && <p className="text-xs text-red-500">{errors.new_password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirm New Password</Label>
            <Input
              id="confirm_password"
              type="password"
              {...register('confirm_password', {
                required: 'Required',
                validate: (v) => v === newPwd || 'Passwords do not match',
              })}
              placeholder="Confirm new password"
            />
            {errors.confirm_password && <p className="text-xs text-red-500">{errors.confirm_password.message}</p>}
          </div>

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Updating…' : 'Change Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Account info section ──────────────────────────────────────────────────────

function AccountSection({ profile }) {
  const rows = [
    { label: 'Email', value: profile.email },
    { label: 'Member since', value: profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
    { label: 'Account status', value: 'Active' },
  ]

  return (
    <Card>
      <CardContent className="pt-6">
        <SectionHeader icon={Info} title="Account" description="Your account information" />
        <dl className="space-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between text-sm">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
  })

  if (isError) {
    return (
      <PageWrapper title="Settings">
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
            <AlertCircle size={18} />
            <span>Could not load settings. Make sure the server is running.</span>
          </CardContent>
        </Card>
      </PageWrapper>
    )
  }

  if (isLoading) {
    return (
      <PageWrapper title="Settings">
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-40 bg-muted rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Settings" description="Manage your profile, security, and account preferences">
      <div className="max-w-2xl space-y-4">
        <ProfileSection profile={profile} />
        <SecuritySection />
        <AccountSection profile={profile} />
      </div>
    </PageWrapper>
  )
}
