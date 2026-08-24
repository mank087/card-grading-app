'use client'

/**
 * Enterprise Organizations admin: create/manage store orgs, members,
 * branding uploads, two-bucket grade-credit pools (monthly reset + rollover
 * overage packs), Stripe checkout links, and incoming enterprise leads.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { BAND_PATTERNS } from '@/lib/labelLab/bandGeometry'
import { ORG_PLANS, ORG_OVERAGE_PACK } from '@/lib/orgPlans'
import LabelDesigner from '@/components/enterprise/LabelDesigner'
import { resolveOrgLabelDesign, designToLegacySlab } from '@/lib/labels/orgLabelDesign'

/** Mirror of orgSerialPrefix's name-derived fallback (first 3 alphanumerics). */
const derivePrefix = (name: string) => ((name || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ORG').slice(0, 3)

interface StorefrontContent {
  tagline?: string
  description?: string
  address?: string
  phone?: string
  public_email?: string
  website?: string
  hours?: string
  legal_name?: string
  hero_logo?: 'color' | 'white' | 'none'
  photo_display?: 'crop' | 'fit'
  show_recent_cards?: boolean
  socials?: Partial<Record<'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'x', string>>
  photos?: string[]
  slab?: { pattern?: string; colors?: string[]; label_style?: 'modern' | 'heritage'; color_source?: 'brand' | 'card' }
}

const SOCIAL_FIELDS: { key: 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'x'; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'x', label: 'X' },
]

interface Org {
  id: string
  name: string
  slug: string
  status: 'pending' | 'active' | 'suspended' | 'cancelled'
  application?: {
    phone?: string | null
    website?: string | null
    monthly_volume?: string | null
    tier_intent?: string | null
    applicant_email?: string | null
  } | null
  tos_accepted_at?: string | null
  plan: string | null
  brand_color: string | null
  brand_colors?: string[] | null
  monthly_credits: number
  overage_credits: number
  grade_credits: number
  monthly_allotment: number
  logo_path: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  serial_prefix?: string | null
  org_serial_seq?: number
  storefront_enabled?: boolean
  storefront?: StorefrontContent | null
  created_at: string
  member_count?: number
  card_count?: number
}

interface Member {
  user_id: string
  role: string
  email: string | null
  created_at: string
}

interface OrgTransaction {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

interface Lead {
  id: string
  store_name: string
  contact_name: string | null
  email: string
  monthly_volume: string | null
  message: string | null
  status: string
  created_at: string
}

export default function OrganizationsAdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSlug, setCreateSlug] = useState('')
  const [createOwnerEmail, setCreateOwnerEmail] = useState('')
  const [creating, setCreating] = useState(false)

  // Detail panel
  const [selected, setSelected] = useState<Org | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [transactions, setTransactions] = useState<OrgTransaction[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [prefixExample, setPrefixExample] = useState<string | null>(null)
  const [linkKind, setLinkKind] = useState<'plan' | 'topup'>('plan')
  const [linkGrades, setLinkGrades] = useState('')
  const [linkAmount, setLinkAmount] = useState('')
  const [linkPlanName, setLinkPlanName] = useState('')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [logoPreviews, setLogoPreviews] = useState<{ color?: string | null; white?: string | null; black?: string | null }>({})
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [brandColors, setBrandColors] = useState<string[]>(['#7C3AED'])
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Storefront tab
  const [sfEnabled, setSfEnabled] = useState(false)
  const [sfContent, setSfContent] = useState<StorefrontContent>({})
  const [sfPhotos, setSfPhotos] = useState<{ path: string; url: string }[]>([])
  const [sfSaving, setSfSaving] = useState(false)
  const [sfUploading, setSfUploading] = useState(false)
  const sfPhotoInputRef = useRef<HTMLInputElement>(null)

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4000)
  }

  const loadAll = useCallback(async () => {
    try {
      const [orgsRes, leadsRes] = await Promise.all([
        fetch('/api/admin/organizations'),
        fetch('/api/admin/enterprise-leads'),
      ])
      if (!orgsRes.ok) throw new Error('Failed to load organizations')
      const orgsData = await orgsRes.json()
      setOrgs(orgsData.organizations || [])
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json()
        setLeads(leadsData.leads || [])
      }
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const openDetail = useCallback(async (org: Org) => {
    setSelected(org)
    setGeneratedLink(null)
    setPrefixExample(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/organizations/${org.id}`)
      if (res.ok) {
        const data = await res.json()
        setSelected(prev => (prev && prev.id === org.id ? { ...prev, ...data.organization } : prev))
        setMembers(data.members || [])
        setTransactions(data.transactions || [])
        // Saved logos come back as signed URLs so previews survive reopen/edit
        setLogoPreviews(data.previews || {})
        const o = data.organization as Org | undefined
        setBrandColors(
          o?.brand_colors?.length ? o.brand_colors : o?.brand_color ? [o.brand_color] : ['#7C3AED']
        )
        setSfEnabled(Boolean(data.organization?.storefront_enabled))
        setSfContent((data.organization?.storefront as StorefrontContent) || {})
        setSfPhotos(data.storefrontPhotoPreviews || [])
      }
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const createOrg = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName, slug: createSlug, ownerEmail: createOwnerEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      flash(`Created ${data.organization.name}`)
      setShowCreate(false)
      setCreateName(''); setCreateSlug(''); setCreateOwnerEmail('')
      await loadAll()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setCreating(false)
    }
  }

  const patchOrg = async (patch: Record<string, unknown>, successMsg: string) => {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      flash(successMsg)
      setSelected(prev => (prev ? { ...prev, ...data.organization } : prev))
      await loadAll()
      if (data.organization) await openDetail(data.organization)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const addMember = async () => {
    if (!selected || !newMemberEmail.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newMemberEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Add failed')
      setNewMemberEmail('')
      flash(`Added ${data.member.email}`)
      await openDetail(selected)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const removeMember = async (userId: string, email: string | null) => {
    if (!selected) return
    if (!confirm(`Remove ${email || userId} from ${selected.name}?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}/members?userId=${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Remove failed')
      flash('Member removed')
      await openDetail(selected)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const uploadLogo = async (file: File) => {
    if (!selected) return
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch(`/api/admin/organizations/${selected.id}/branding`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setLogoPreviews(data.previews || {})
      flash('Logo uploaded — white and black variants derived')
      await loadAll()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setUploadingLogo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const saveStorefront = async () => {
    if (!selected) return
    setSfSaving(true)
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}/storefront`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storefront_enabled: sfEnabled, storefront: sfContent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSfEnabled(Boolean(data.storefront_enabled))
      setSfContent(data.storefront || {})
      flash('Storefront saved')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSfSaving(false)
    }
  }

  const uploadStorePhoto = async (file: File) => {
    if (!selected) return
    setSfUploading(true)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      const res = await fetch(`/api/admin/organizations/${selected.id}/storefront`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setSfPhotos(prev => [...prev, { path: data.path, url: data.signedUrl }])
      setSfContent(prev => ({ ...prev, photos: [...(prev.photos || []), data.path] }))
      flash('Photo uploaded')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSfUploading(false)
      if (sfPhotoInputRef.current) sfPhotoInputRef.current.value = ''
    }
  }

  const removeStorePhoto = async (path: string) => {
    if (!selected) return
    if (!confirm('Remove this store photo?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}/storefront?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Remove failed')
      setSfPhotos(prev => prev.filter(p => p.path !== path))
      setSfContent(prev => ({ ...prev, photos: (prev.photos || []).filter(p => p !== path) }))
      flash('Photo removed')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const generateLink = async () => {
    if (!selected) return
    setBusy(true)
    setGeneratedLink(null)
    try {
      const res = await fetch(`/api/admin/organizations/${selected.id}/checkout-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: linkKind,
          grades: parseInt(linkGrades, 10),
          amountUsd: parseFloat(linkAmount),
          planName: linkPlanName || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Link generation failed')
      setGeneratedLink(data.url)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const setLeadStatus = async (id: string, status: string) => {
    const res = await fetch('/api/admin/enterprise-leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) {
      setLeads(prev => prev.map(l => (l.id === id ? { ...l, status } : l)))
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  }
  if (error) return <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>

  const statusBadge = (status: string) => {
    const cls = status === 'active' ? 'bg-green-100 text-green-700'
      : status === 'pending' ? 'bg-amber-100 text-amber-700'
      : status === 'suspended' ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-200 text-gray-600'
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="text-gray-600 mt-1">Enterprise store accounts — branding, members, and rolling grade-credit pools</p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
        >
          {showCreate ? 'Cancel' : '+ New Organization'}
        </button>
      </div>

      {notice && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{notice}</div>}

      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 grid gap-3 sm:grid-cols-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Store name</label>
            <input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Apex Grading"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Slug (lowercase, hyphens)</label>
            <input value={createSlug} onChange={e => setCreateSlug(e.target.value.toLowerCase())} placeholder="apex"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Owner email (existing user)</label>
            <input value={createOwnerEmail} onChange={e => setCreateOwnerEmail(e.target.value)} placeholder="owner@store.com"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <button onClick={createOrg} disabled={creating || !createName || !createSlug || !createOwnerEmail}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      )}

      {/* Org list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">Pool balance</th>
              <th className="px-4 py-3 text-right">Monthly deposit</th>
              <th className="px-4 py-3 text-right">Members</th>
              <th className="px-4 py-3 text-right">Cards graded</th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No organizations yet</td></tr>
            )}
            {orgs.map(org => (
              <tr key={org.id}
                onClick={() => openDetail(org)}
                className={`border-b border-gray-100 cursor-pointer hover:bg-purple-50 ${selected?.id === org.id ? 'bg-purple-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: org.brand_color || '#7C3AED' }} />
                    {org.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    /{org.slug}
                    {' · '}
                    <a href={`/enterprise/${org.slug}`} target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-purple-600 hover:text-purple-800 underline">
                      Enterprise Page ↗
                    </a>
                  </div>
                </td>
                <td className="px-4 py-3">{statusBadge(org.status)}</td>
                <td className="px-4 py-3 text-gray-700">{org.plan || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{org.grade_credits}</td>
                <td className="px-4 py-3 text-right text-gray-700">{org.monthly_allotment || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-700">{org.member_count ?? '—'}</td>
                <td className="px-4 py-3 text-right text-gray-700">{org.card_count ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">{selected.name}</h2>
              <a href={`/enterprise/${selected.slug}`} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:border-purple-400">
                View Enterprise Page ↗
              </a>
            </div>
            <div className="flex items-center gap-2">
              {(['active', 'suspended', 'cancelled'] as const).map(s => (
                <button key={s}
                  onClick={() => s !== selected.status && patchOrg({ status: s }, `Status → ${s}`)}
                  disabled={busy}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${selected.status === s
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {detailLoading && <div className="text-sm text-gray-400">Loading…</div>}

          {/* Pending application review card */}
          {selected.status === 'pending' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm font-semibold text-amber-800">
                  Self-serve application awaiting review
                  {selected.tos_accepted_at && (
                    <span className="font-normal text-amber-600"> · ToS accepted {new Date(selected.tos_accepted_at).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => patchOrg({ status: 'active' }, `${selected.name} approved`)}
                    disabled={busy}
                    className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Reject ${selected.name}? The applicant keeps their DCM account but the store is closed.`)) {
                        patchOrg({ status: 'cancelled' }, `${selected.name} rejected`)
                      }
                    }}
                    disabled={busy}
                    className="px-4 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50">
                    Reject
                  </button>
                </div>
              </div>
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 text-xs text-amber-900">
                <div><span className="text-amber-600">Applicant:</span> {selected.application?.applicant_email || '—'}</div>
                <div><span className="text-amber-600">Phone:</span> {selected.application?.phone || '—'}</div>
                <div><span className="text-amber-600">Website:</span> {selected.application?.website || '—'}</div>
                <div><span className="text-amber-600">Volume estimate:</span> {selected.application?.monthly_volume || '—'}</div>
                <div><span className="text-amber-600">Tier interest:</span> {selected.application?.tier_intent || '—'}</div>
                <div><span className="text-amber-600">Logo:</span> {logoPreviews.color ? 'uploaded (see Branding)' : 'not uploaded'}</div>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Branding */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Branding</h3>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs text-gray-500">Brand colors</label>
                  {brandColors.map((c, i) => (
                    <div key={i} className="relative flex flex-col items-center">
                      <input type="color" value={c}
                        onChange={e => setBrandColors(prev => prev.map((p, j) => (j === i ? e.target.value : p)))}
                        onBlur={() => {
                          const saved = selected.brand_colors?.length ? selected.brand_colors : selected.brand_color ? [selected.brand_color] : []
                          if (JSON.stringify(brandColors) !== JSON.stringify(saved)) {
                            patchOrg({ brandColors }, 'Brand colors updated')
                          }
                        }}
                        className="w-8 h-8 border border-gray-300 rounded cursor-pointer" />
                      <button
                        onClick={() => {
                          const next = brandColors.filter((_, j) => j !== i)
                          setBrandColors(next)
                          patchOrg({ brandColors: next }, 'Brand color removed')
                        }}
                        disabled={brandColors.length <= 1 || busy}
                        title="Remove color"
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-gray-600 text-white text-[10px] hover:bg-red-600 disabled:opacity-30 disabled:hover:bg-gray-600">
                        ✕
                      </button>
                      {i === 0 && <span className="text-[10px] text-gray-400 mt-0.5">Primary</span>}
                    </div>
                  ))}
                  {brandColors.length < 5 && (
                    <button
                      onClick={() => {
                        const next = [...brandColors, brandColors[brandColors.length - 1] || '#7C3AED']
                        setBrandColors(next)
                        patchOrg({ brandColors: next }, 'Brand color added')
                      }}
                      disabled={busy}
                      className="px-2 py-1 border border-gray-300 rounded text-xs hover:border-purple-400 disabled:opacity-50">
                      + Add color
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">The org&apos;s brand palette. Auto-filled from the uploaded logo — edit freely. The first color is the primary accent used across their pages and labels.</p>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-500">Serial prefix</label>
                  <input maxLength={6} key={selected.id}
                    defaultValue={selected.serial_prefix || derivePrefix(selected.name)}
                    onChange={e => {
                      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                      setPrefixExample(e.target.value || derivePrefix(selected.name))
                    }}
                    onBlur={e => e.target.value !== (selected.serial_prefix || derivePrefix(selected.name)) && patchOrg({ serialPrefix: e.target.value }, 'Serial prefix updated')}
                    className="w-24 border border-gray-300 rounded px-2 py-1 text-sm font-mono uppercase" />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Prefix for this org&apos;s card serials, e.g. {(prefixExample ?? (selected.serial_prefix || derivePrefix(selected.name)))}442921.
                  Serial numbers are random and unique per org. Changing the prefix only affects future serial displays.
                </p>
              </div>
              <div>
                <input ref={fileInputRef} type="file" accept="image/png"
                  onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                  className="hidden" id="org-logo-input" />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-purple-400 disabled:opacity-50">
                  {uploadingLogo ? 'Uploading…' : selected.logo_path ? 'Replace logo (PNG)' : 'Upload logo (PNG)'}
                </button>
                <p className="text-xs text-gray-400 mt-1">Transparent PNG, ≥256px. White and black variants are derived automatically.</p>
              </div>
              {(logoPreviews.color || logoPreviews.white || logoPreviews.black) && (
                <div className="flex gap-3">
                  {logoPreviews.color && (
                    <div className="border border-gray-200 rounded p-2 bg-gray-50"><img src={logoPreviews.color} alt="logo" className="h-14" /></div>
                  )}
                  {logoPreviews.white && (
                    <div className="border border-gray-200 rounded p-2 bg-gray-900"><img src={logoPreviews.white} alt="white variant" className="h-14" /></div>
                  )}
                  {logoPreviews.black && (
                    <div className="border border-gray-200 rounded p-2 bg-white"><img src={logoPreviews.black} alt="black variant" className="h-14" /></div>
                  )}
                </div>
              )}
            </div>

            {/* Pool + billing */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Grade credit pool</h3>
              <div className="space-y-0.5">
                <div className="text-lg font-bold text-gray-900">
                  Monthly: {selected.monthly_credits}
                  <span className="text-sm font-normal text-gray-500"> / {selected.monthly_allotment} this cycle (resets)</span>
                </div>
                <div className="text-lg font-bold text-gray-900">
                  Overage: {selected.overage_credits}
                  <span className="text-sm font-normal text-gray-500"> (rolls over)</span>
                </div>
                <div className="text-xs text-gray-400">Total spendable: {selected.grade_credits}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Monthly allotment</label>
                <input type="number" min={0} defaultValue={selected.monthly_allotment}
                  onBlur={e => {
                    const v = parseInt(e.target.value, 10)
                    if (Number.isInteger(v) && v >= 0 && v !== selected.monthly_allotment) {
                      patchOrg({ monthlyAllotment: v }, 'Monthly allotment updated')
                    }
                  }}
                  className="w-24 border border-gray-300 rounded px-2 py-1 text-sm" />
                <label className="text-xs text-gray-500 ml-2">Plan label</label>
                <input defaultValue={selected.plan || ''}
                  onBlur={e => e.target.value !== (selected.plan || '') && patchOrg({ plan: e.target.value }, 'Plan updated')}
                  placeholder="dealer / enterprise / custom"
                  className="w-40 border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                  placeholder="±overage" title="Adjustments apply to the overage (rollover) bucket"
                  className="w-24 border border-gray-300 rounded px-2 py-1 text-sm" />
                <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Reason (audit trail)" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
                <button
                  onClick={() => {
                    const v = parseInt(adjustAmount, 10)
                    if (!Number.isInteger(v) || v === 0) return
                    patchOrg({ adjustCredits: v, adjustReason }, `Pool adjusted by ${v}`)
                    setAdjustAmount(''); setAdjustReason('')
                  }}
                  disabled={busy}
                  className="px-3 py-1 border border-gray-300 rounded text-sm hover:border-purple-400">
                  Adjust
                </button>
              </div>

              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide pt-2">Stripe checkout link</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {Object.values(ORG_PLANS).map(p => (
                  <button key={p.key}
                    onClick={() => {
                      setLinkKind('plan')
                      setLinkGrades(String(p.gradesPerMonth))
                      setLinkAmount(String(p.priceUsd))
                      setLinkPlanName(p.key)
                    }}
                    className="px-2.5 py-1 border border-purple-200 bg-purple-50 text-purple-700 rounded text-xs hover:border-purple-400">
                    {p.name} ${p.priceUsd}/{p.gradesPerMonth}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setLinkKind('topup')
                    setLinkGrades(String(ORG_OVERAGE_PACK.grades))
                    setLinkAmount(String(ORG_OVERAGE_PACK.priceUsd))
                  }}
                  className="px-2.5 py-1 border border-purple-200 bg-purple-50 text-purple-700 rounded text-xs hover:border-purple-400">
                  {ORG_OVERAGE_PACK.grades}-pack ${ORG_OVERAGE_PACK.priceUsd}
                </button>
                <span className="text-xs text-gray-400">presets — or type custom amounts (pilot deals)</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={linkKind} onChange={e => setLinkKind(e.target.value as 'plan' | 'topup')}
                  className="border border-gray-300 rounded px-2 py-1 text-sm">
                  <option value="plan">Monthly plan (subscription)</option>
                  <option value="topup">Overage top-up (one-time)</option>
                </select>
                <input type="number" value={linkGrades} onChange={e => setLinkGrades(e.target.value)}
                  placeholder="grades" className="w-24 border border-gray-300 rounded px-2 py-1 text-sm" />
                <input type="number" value={linkAmount} onChange={e => setLinkAmount(e.target.value)}
                  placeholder="$ USD" className="w-24 border border-gray-300 rounded px-2 py-1 text-sm" />
                {linkKind === 'plan' && (
                  <input value={linkPlanName} onChange={e => setLinkPlanName(e.target.value)}
                    placeholder="plan name" className="w-28 border border-gray-300 rounded px-2 py-1 text-sm" />
                )}
                <button onClick={generateLink} disabled={busy || !linkGrades || !linkAmount}
                  className="px-3 py-1 bg-purple-600 text-white rounded text-sm disabled:opacity-50">
                  Generate
                </button>
              </div>
              {generatedLink && (
                <div className="flex items-center gap-2 text-sm">
                  <input readOnly value={generatedLink} className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs bg-gray-50" />
                  <button onClick={() => { navigator.clipboard.writeText(generatedLink); flash('Link copied') }}
                    className="px-3 py-1 border border-gray-300 rounded text-sm hover:border-purple-400">Copy</button>
                </div>
              )}
              <p className="text-xs text-gray-400">
                Subscription: {selected.stripe_subscription_id ? `attached (${selected.stripe_subscription_id.slice(0, 14)}…)` : 'not attached — send a plan link'}
              </p>
            </div>
          </div>

          {/* Storefront */}
          <div className="space-y-4 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Storefront</h3>

            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={sfEnabled} onChange={e => setSfEnabled(e.target.checked)}
                  className="w-4 h-4 accent-purple-600" />
                Enterprise Page enabled
              </label>
              <span className="text-xs text-gray-400">
                Live at /enterprise/{selected.slug} and https://{selected.slug}.dcmgrading.com
              </span>
              <a href={`/enterprise/${selected.slug}`} target="_blank" rel="noreferrer"
                className="text-xs text-purple-600 hover:text-purple-800 underline">
                Open preview
              </a>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={Boolean(sfContent.show_recent_cards)}
                  onChange={e => setSfContent(prev => ({ ...prev, show_recent_cards: e.target.checked }))}
                  className="w-4 h-4 accent-purple-600" />
                Show recently graded cards
              </label>
              <p className="text-xs text-gray-400 mt-1 ml-6">Displays the 10 most recently graded public cards on the storefront homepage, linking to their branded report pages. Off by default — new stores may prefer to wait until they have volume.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tagline</label>
                <input value={sfContent.tagline || ''} onChange={e => setSfContent(prev => ({ ...prev, tagline: e.target.value }))}
                  placeholder="Your friendly local card shop" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input value={sfContent.phone || ''} onChange={e => setSfContent(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 555-5555" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea value={sfContent.description || ''} onChange={e => setSfContent(prev => ({ ...prev, description: e.target.value }))}
                  rows={4} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">About headline</label>
                <input value={(sfContent as any).about_title || ''}
                  onChange={e => setSfContent(prev => ({ ...prev, about_title: e.target.value } as any))}
                  placeholder="Professional grading, in-store" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Highlight bullets (one per line, up to 5)</label>
                <textarea
                  value={((sfContent as any).about_bullets as string[] | undefined)?.join('\n') ?? ''}
                  onChange={e => setSfContent(prev => ({
                    ...prev,
                    about_bullets: e.target.value.split('\n').slice(0, 5),
                  } as any))}
                  rows={3} placeholder="Standard bullets show until customized; clearing all lines hides the list"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Address</label>
                <textarea value={sfContent.address || ''} onChange={e => setSfContent(prev => ({ ...prev, address: e.target.value }))}
                  rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hours</label>
                <textarea value={sfContent.hours || ''} onChange={e => setSfContent(prev => ({ ...prev, hours: e.target.value }))}
                  rows={3} placeholder={'Mon–Fri 10–7\nSat 10–5'} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Public email</label>
                <input value={sfContent.public_email || ''} onChange={e => setSfContent(prev => ({ ...prev, public_email: e.target.value }))}
                  placeholder="hello@store.com" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Website</label>
                <input value={sfContent.website || ''} onChange={e => setSfContent(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://store.com" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Legal name</label>
                <input value={sfContent.legal_name || ''} maxLength={120}
                  onChange={e => setSfContent(prev => ({ ...prev, legal_name: e.target.value }))}
                  placeholder="Manifold Grading LLC" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 mt-1">Shown in the storefront copyright line, e.g. Manifold Grading LLC — leave blank to use the display name</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hero logo</label>
                <select value={sfContent.hero_logo || 'color'}
                  onChange={e => setSfContent(prev => ({ ...prev, hero_logo: e.target.value as StorefrontContent['hero_logo'] }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="color">Color (default)</option>
                  <option value="white">White</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Photo display</label>
                <select value={sfContent.photo_display || 'crop'}
                  onChange={e => setSfContent(prev => ({ ...prev, photo_display: e.target.value as StorefrontContent['photo_display'] }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                  <option value="crop">Crop to fill</option>
                  <option value="fit">Fit whole image</option>
                </select>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Socials (full URLs)</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SOCIAL_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{label}</label>
                    <input value={sfContent.socials?.[key] || ''}
                      onChange={e => setSfContent(prev => ({ ...prev, socials: { ...prev.socials, [key]: e.target.value } }))}
                      placeholder={`https://${key === 'x' ? 'x.com' : key + '.com'}/…`}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Store photos <span className="font-normal normal-case text-gray-400">({sfPhotos.length}/8)</span>
              </h4>
              <div className="flex flex-wrap gap-3">
                {sfPhotos.map(photo => (
                  <div key={photo.path} className="relative border border-gray-200 rounded overflow-hidden bg-gray-50">
                    <img src={photo.url} alt="store photo" className="h-24 w-32 object-cover" />
                    <button onClick={() => removeStorePhoto(photo.path)} disabled={busy}
                      title="Remove photo"
                      className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white text-xs hover:bg-red-600">
                      ✕
                    </button>
                  </div>
                ))}
                {sfPhotos.length < 8 && (
                  <div>
                    <input ref={sfPhotoInputRef} type="file" accept="image/*"
                      onChange={e => e.target.files?.[0] && uploadStorePhoto(e.target.files[0])}
                      className="hidden" id="org-store-photo-input" />
                    <button onClick={() => sfPhotoInputRef.current?.click()} disabled={sfUploading}
                      className="h-24 w-32 border border-dashed border-gray-300 rounded text-sm text-gray-500 hover:border-purple-400 disabled:opacity-50">
                      {sfUploading ? 'Uploading…' : '+ Add photo'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Slab design</h4>
              <p className="text-xs text-gray-400 mb-3">
                The org&apos;s house label design — what prints on every slab label and shows on the public card pages and storefront mockup. Edits apply when you save the storefront.
              </p>
              <LabelDesigner
                design={resolveOrgLabelDesign(sfContent)}
                onChange={d => setSfContent(prev => ({ ...prev, slab: { ...prev.slab, ...designToLegacySlab(d), design: d } }))}
                orgName={selected.name}
                serialPrefix={selected.serial_prefix || derivePrefix(selected.name)}
                brandColors={brandColors}
                logos={{ color: logoPreviews.color ?? null, white: logoPreviews.white ?? null, black: logoPreviews.black ?? null }}
              />
            </div>

            <button onClick={saveStorefront} disabled={sfSaving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              {sfSaving ? 'Saving…' : 'Save storefront'}
            </button>
          </div>

          {/* Members */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Members</h3>
            <div className="flex items-center gap-2">
              <input value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)}
                placeholder="member@store.com" className="w-64 border border-gray-300 rounded px-2 py-1 text-sm" />
              <button onClick={addMember} disabled={busy || !newMemberEmail.trim()}
                className="px-3 py-1 border border-gray-300 rounded text-sm hover:border-purple-400 disabled:opacity-50">
                Add member
              </button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {members.map(m => (
                  <tr key={m.user_id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{m.email || m.user_id}</td>
                    <td className="py-2 text-gray-500">{m.role}</td>
                    <td className="py-2 text-right">
                      {m.role !== 'owner' && (
                        <button onClick={() => removeMember(m.user_id, m.email)}
                          className="text-xs text-red-500 hover:text-red-700">Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Transactions */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pool activity (last 50)</h3>
            <div className="max-h-64 overflow-y-auto border border-gray-100 rounded">
              <table className="w-full text-xs">
                <tbody>
                  {transactions.length === 0 && (
                    <tr><td className="px-3 py-3 text-gray-400">No activity yet</td></tr>
                  )}
                  {transactions.map(t => (
                    <tr key={t.id} className="border-b border-gray-50">
                      <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-gray-600">{t.type}</td>
                      <td className={`px-3 py-1.5 text-right font-medium ${t.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-400">bal {t.balance_after}</td>
                      <td className="px-3 py-1.5 text-gray-500">{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Enterprise leads */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Enterprise leads</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-gray-400">No inquiries yet — they arrive from the /enterprise page.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2">Store</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Volume</th>
                  <th className="px-3 py-2">Message</th>
                  <th className="px-3 py-2">Received</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-2 font-medium text-gray-900">{lead.store_name}</td>
                    <td className="px-3 py-2 text-gray-600">
                      <div>{lead.contact_name || '—'}</div>
                      <a href={`mailto:${lead.email}`} className="text-purple-600 text-xs">{lead.email}</a>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{lead.monthly_volume || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 max-w-xs whitespace-pre-wrap">{lead.message || '—'}</td>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{new Date(lead.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <select value={lead.status} onChange={e => setLeadStatus(lead.id, e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-xs">
                        <option value="new">new</option>
                        <option value="contacted">contacted</option>
                        <option value="converted">converted</option>
                        <option value="closed">closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
