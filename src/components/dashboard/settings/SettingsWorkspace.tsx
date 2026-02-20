'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { LANDING_PRICING_TEMPLATE_ROWS } from '@/lib/landing-pricing-config'
import type {
  LoginHistorySnapshot,
  SettingsProfileSnapshot,
  SystemConfigSnapshot,
  WishlistSnapshot,
} from '@/lib/settings'

type Props = {
  locale?: string
  profile: SettingsProfileSnapshot
  loginHistory: LoginHistorySnapshot[]
  wishlist: WishlistSnapshot[]
  systemConfig: SystemConfigSnapshot[]
}

type ProfileForm = {
  name: string
  phone: string
  avatarUrl: string
  preferredLanguage: 'fr' | 'en'
  notifyEmail: boolean
  notifySms: boolean
  notifyPush: boolean
  twoFactorEnabled: boolean
  dashboardCompact: boolean
  companyName: string
  companyLogoUrl: string
}

function toForm(profile: SettingsProfileSnapshot): ProfileForm {
  return {
    name: profile.name ?? '',
    phone: profile.phone ?? '',
    avatarUrl: profile.avatarUrl ?? '',
    preferredLanguage: profile.preferredLanguage === 'en' ? 'en' : 'fr',
    notifyEmail: profile.notifyEmail,
    notifySms: profile.notifySms,
    notifyPush: profile.notifyPush,
    twoFactorEnabled: profile.twoFactorEnabled,
    dashboardCompact: profile.dashboardCompact,
    companyName: profile.companyName ?? '',
    companyLogoUrl: profile.companyLogoUrl ?? '',
  }
}

function firstErrorMessage(payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) return payload
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof (payload as { message?: unknown }).message === 'string'
  ) {
    return (payload as { message: string }).message
  }
  if (Array.isArray(payload) && typeof payload[0]?.message === 'string') return String(payload[0].message)
  return 'Operation failed.'
}

export function SettingsWorkspace({ locale, profile, loginHistory, wishlist: initialWishlist, systemConfig: initialSystemConfig }: Props) {
  const role = profile.role
  const isTenant = role === 'TENANT'
  const canManageCompany = role === 'MANAGER' || role === 'ADMIN'
  const canManageSystem = role === 'ADMIN'
  const localePrefix = locale ? `/${locale}` : ''

  const [form, setForm] = useState<ProfileForm>(toForm(profile))
  const uiLocale = form.preferredLanguage === 'en' ? 'en-US' : 'fr-FR'
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  const [wishlist, setWishlist] = useState<WishlistSnapshot[]>(initialWishlist)
  const [wishlistPropertyId, setWishlistPropertyId] = useState('')
  const [wishlistMessage, setWishlistMessage] = useState('')
  const [wishlistError, setWishlistError] = useState('')
  const [wishlistBusy, setWishlistBusy] = useState(false)

  const [systemConfig, setSystemConfig] = useState<SystemConfigSnapshot[]>(initialSystemConfig)
  const [systemMessage, setSystemMessage] = useState('')
  const [systemError, setSystemError] = useState('')
  const [systemBusy, setSystemBusy] = useState(false)

  const loginRows = useMemo(
    () =>
      loginHistory.map((h) => ({
        ...h,
        when: new Date(h.createdAt).toLocaleString(uiLocale),
        ip: h.ipAddress ?? 'Unknown IP',
        agent: h.userAgent?.slice(0, 96) ?? 'Unknown agent',
      })),
    [loginHistory, uiLocale]
  )

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileBusy(true)
    setProfileMessage('')
    setProfileError('')
    try {
      const response = await fetch('/api/settings/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || null,
          phone: form.phone.trim() || null,
          avatarUrl: form.avatarUrl.trim() || null,
          preferredLanguage: form.preferredLanguage,
          notifyEmail: form.notifyEmail,
          notifySms: form.notifySms,
          notifyPush: form.notifyPush,
          twoFactorEnabled: form.twoFactorEnabled,
          ...(canManageCompany
            ? {
                dashboardCompact: form.dashboardCompact,
                companyName: form.companyName.trim() || null,
                companyLogoUrl: form.companyLogoUrl.trim() || null,
              }
            : {}),
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setProfileError(firstErrorMessage(result.error))
        return
      }
      setProfileMessage('Profile updated.')
    } catch {
      setProfileError('Network error while saving profile.')
    } finally {
      setProfileBusy(false)
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordBusy(true)
    setPasswordMessage('')
    setPasswordError('')
    try {
      const response = await fetch('/api/settings/password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setPasswordError(firstErrorMessage(result.error))
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password changed successfully.')
    } catch {
      setPasswordError('Network error while updating password.')
    } finally {
      setPasswordBusy(false)
    }
  }

  async function refreshWishlist() {
    const response = await fetch('/api/settings/wishlist', { credentials: 'include' })
    if (!response.ok) return
    const result = await response.json().catch(() => [])
    if (!Array.isArray(result)) return
    setWishlist(result.map((row) => ({
      propertyId: row.propertyId,
      createdAt: row.createdAt,
      title: row.property.title,
      city: row.property.city,
      address: row.property.address,
      price: row.property.price,
      status: row.property.status,
    })))
  }

  async function addWishlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!wishlistPropertyId.trim()) return
    setWishlistBusy(true)
    setWishlistError('')
    setWishlistMessage('')
    try {
      const response = await fetch('/api/settings/wishlist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: wishlistPropertyId.trim() }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setWishlistError(firstErrorMessage(result.error))
        return
      }
      setWishlistPropertyId('')
      setWishlistMessage('Property added to wishlist.')
      await refreshWishlist()
    } catch {
      setWishlistError('Network error while updating wishlist.')
    } finally {
      setWishlistBusy(false)
    }
  }

  async function removeWishlist(propertyId: string) {
    setWishlistBusy(true)
    setWishlistError('')
    setWishlistMessage('')
    try {
      const response = await fetch('/api/settings/wishlist', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setWishlistError(firstErrorMessage(result.error))
        return
      }
      setWishlist((prev) => prev.filter((row) => row.propertyId !== propertyId))
      setWishlistMessage('Wishlist updated.')
    } catch {
      setWishlistError('Network error while updating wishlist.')
    } finally {
      setWishlistBusy(false)
    }
  }

  function updateConfig(index: number, key: 'key' | 'value' | 'description', value: string) {
    setSystemConfig((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: key === 'description' ? value || null : value } : row)))
  }

  function addLandingPricingTemplates() {
    const now = new Date().toISOString()
    setSystemConfig((prev) => {
      const map = new Map(prev.map((row) => [row.key.toUpperCase(), row]))
      for (const template of LANDING_PRICING_TEMPLATE_ROWS) {
        const key = template.key.toUpperCase()
        if (!map.has(key)) {
          map.set(key, {
            key,
            value: template.value,
            description: template.description,
            updatedAt: now,
          })
        }
      }
      return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
    })
    setSystemMessage('Landing pricing template rows added.')
    setSystemError('')
  }

  async function saveSystemConfig() {
    setSystemBusy(true)
    setSystemError('')
    setSystemMessage('')
    try {
      const settings = systemConfig
        .map((row) => ({ key: row.key.trim().toUpperCase(), value: row.value.trim(), description: row.description?.trim() || null }))
        .filter((row) => row.key.length > 0 && row.value.length > 0)
      if (settings.length === 0) {
        setSystemError('Provide at least one config row.')
        return
      }
      const response = await fetch('/api/admin/system-config', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSystemError(firstErrorMessage(result.error))
        return
      }
      if (Array.isArray(result)) {
        setSystemConfig(result.map((row) => ({
          key: row.key,
          value: row.value,
          description: row.description,
          updatedAt: row.updatedAt,
        })))
      }
      setSystemMessage('System configuration saved.')
    } catch {
      setSystemError('Network error while saving system config.')
    } finally {
      setSystemBusy(false)
    }
  }

  return (
    <section className='space-y-6'>
      <header className='space-y-2'>
        <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>Settings</h1>
        <p className='text-sm text-slate-500 dark:text-slate-400'>Role-aware profile, security and platform preferences.</p>
        <div className='flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400'>
          <Badge variant='outline'>Role: {role}</Badge>
          <Badge variant='outline'>Account: {new Date(profile.createdAt).toLocaleDateString(uiLocale)}</Badge>
          {profile.lastLoginAt ? (
            <Badge variant='outline'>Last login: {new Date(profile.lastLoginAt).toLocaleString(uiLocale)}</Badge>
          ) : null}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage identity and notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='space-y-4' onSubmit={saveProfile}>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Email</Label>
                <Input value={profile.email} disabled />
              </div>
              <div className='space-y-2'>
                <Label>Full Name</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className='space-y-2'>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className='space-y-2'>
                <Label>Avatar URL</Label>
                <Input value={form.avatarUrl} onChange={(e) => setForm((p) => ({ ...p, avatarUrl: e.target.value }))} />
              </div>
              <div className='space-y-2'>
                <Label>Preferred Language</Label>
                <Select value={form.preferredLanguage} onValueChange={(v) => setForm((p) => ({ ...p, preferredLanguage: v === 'en' ? 'en' : 'fr' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='fr'>Francais</SelectItem>
                    <SelectItem value='en'>English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {canManageCompany ? (
                <>
                  <div className='space-y-2'>
                    <Label>Company Name</Label>
                    <Input value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
                  </div>
                  <div className='space-y-2'>
                    <Label>Company Logo URL</Label>
                    <Input value={form.companyLogoUrl} onChange={(e) => setForm((p) => ({ ...p, companyLogoUrl: e.target.value }))} />
                  </div>
                </>
              ) : null}
            </div>

            <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
              <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={form.notifyEmail} onChange={(e) => setForm((p) => ({ ...p, notifyEmail: e.target.checked }))} /> Email notifications</label>
              <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={form.notifySms} onChange={(e) => setForm((p) => ({ ...p, notifySms: e.target.checked }))} /> SMS notifications</label>
              <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={form.notifyPush} onChange={(e) => setForm((p) => ({ ...p, notifyPush: e.target.checked }))} /> Push notifications</label>
              <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={form.twoFactorEnabled} onChange={(e) => setForm((p) => ({ ...p, twoFactorEnabled: e.target.checked }))} /> Enable 2FA (soft toggle)</label>
              {canManageCompany ? <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={form.dashboardCompact} onChange={(e) => setForm((p) => ({ ...p, dashboardCompact: e.target.checked }))} /> Compact dashboard KPI layout</label> : null}
            </div>

            {profileError ? <p className='text-sm text-rose-600 dark:text-rose-400'>{profileError}</p> : null}
            {profileMessage ? <p className='text-sm text-emerald-600 dark:text-emerald-400'>{profileMessage}</p> : null}
            <div className='flex justify-end'><Button type='submit' disabled={profileBusy}>{profileBusy ? 'Saving...' : 'Save profile'}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password & Security</CardTitle>
          <CardDescription>Update password and inspect recent logins.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <form className='grid grid-cols-1 gap-4 md:grid-cols-3' onSubmit={savePassword}>
            <div className='space-y-2'><Label>Current Password</Label><Input type='password' value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>
            <div className='space-y-2'><Label>New Password</Label><Input type='password' value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
            <div className='space-y-2'><Label>Confirm Password</Label><Input type='password' value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
            <div className='md:col-span-3 flex items-center justify-between'>
              <div>
                {passwordError ? <p className='text-sm text-rose-600 dark:text-rose-400'>{passwordError}</p> : null}
                {passwordMessage ? <p className='text-sm text-emerald-600 dark:text-emerald-400'>{passwordMessage}</p> : null}
              </div>
              <Button type='submit' disabled={passwordBusy}>{passwordBusy ? 'Updating...' : 'Update password'}</Button>
            </div>
          </form>

          <div className='overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-800'>
            <table className='w-full text-sm'>
              <thead className='bg-slate-50 dark:bg-slate-900/70'><tr><th className='px-3 py-2 text-left'>Date</th><th className='px-3 py-2 text-left'>IP</th><th className='px-3 py-2 text-left'>Agent</th><th className='px-3 py-2 text-left'>Status</th></tr></thead>
              <tbody>
                {loginRows.map((row) => (
                  <tr key={row.id} className='border-t border-slate-200/70 dark:border-slate-800'>
                    <td className='px-3 py-2'>{row.when}</td><td className='px-3 py-2'>{row.ip}</td><td className='px-3 py-2'>{row.agent}</td>
                    <td className='px-3 py-2'><Badge variant={row.success ? 'success' : 'destructive'}>{row.success ? 'Success' : 'Failed'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isTenant ? (
        <Card>
          <CardHeader><CardTitle>Wishlist</CardTitle><CardDescription>Track listings and revisit them quickly.</CardDescription></CardHeader>
          <CardContent className='space-y-4'>
            <form className='flex gap-2' onSubmit={addWishlist}>
              <Input value={wishlistPropertyId} onChange={(e) => setWishlistPropertyId(e.target.value)} placeholder='Property ID (cuid)' />
              <Button type='submit' disabled={wishlistBusy}>Add</Button>
            </form>
            {wishlistError ? <p className='text-sm text-rose-600 dark:text-rose-400'>{wishlistError}</p> : null}
            {wishlistMessage ? <p className='text-sm text-emerald-600 dark:text-emerald-400'>{wishlistMessage}</p> : null}
            {wishlist.length === 0 ? <p className='text-sm text-slate-500 dark:text-slate-400'>No favorite listing yet.</p> : (
              <div className='space-y-2'>
                {wishlist.map((item) => (
                  <div key={item.propertyId} className='flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 px-3 py-2 dark:border-slate-800'>
                    <div>
                      <p className='font-medium'>{item.title}</p>
                      <p className='text-xs text-slate-500 dark:text-slate-400'>{[item.city, item.address].filter(Boolean).join(', ')} - {item.price.toLocaleString(uiLocale)} FCFA</p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button asChild size='sm' variant='outline'><Link href={`${localePrefix}/marketplace/${item.propertyId}`}>Open</Link></Button>
                      <Button size='sm' variant='destructive' disabled={wishlistBusy} onClick={() => removeWishlist(item.propertyId)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canManageSystem ? (
        <Card>
          <CardHeader><CardTitle>System Configuration</CardTitle><CardDescription>Global parameters for platform operations.</CardDescription></CardHeader>
          <CardContent className='space-y-4'>
            {systemConfig.map((row, index) => (
              <div key={`${row.key}-${index}`} className='space-y-2 rounded-xl border border-border bg-card p-3'>
                <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
                  <Input value={row.key} placeholder='KEY_NAME' onChange={(e) => updateConfig(index, 'key', e.target.value.toUpperCase())} />
                  <Input value={row.description ?? ''} placeholder='Description' onChange={(e) => updateConfig(index, 'description', e.target.value)} />
                </div>
                <Textarea value={row.value} placeholder='Value (JSON/string)' className='min-h-28 font-mono text-xs' onChange={(e) => updateConfig(index, 'value', e.target.value)} />
              </div>
            ))}
            <div className='flex items-center gap-2'>
              <Button variant='outline' onClick={addLandingPricingTemplates}>Add pricing templates</Button>
              <Button variant='outline' onClick={() => setSystemConfig((prev) => [...prev, { key: '', value: '', description: null, updatedAt: new Date().toISOString() }])}>Add row</Button>
              <Button onClick={saveSystemConfig} disabled={systemBusy}>{systemBusy ? 'Saving...' : 'Save config'}</Button>
            </div>
            {systemError ? <p className='text-sm text-rose-600 dark:text-rose-400'>{systemError}</p> : null}
            {systemMessage ? <p className='text-sm text-emerald-600 dark:text-emerald-400'>{systemMessage}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
