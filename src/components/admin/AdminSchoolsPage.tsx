import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Building2, Plus, Search, ExternalLink, Copy, Check, X, AlertCircle, Users, Globe, ToggleLeft, ToggleRight, Pencil } from 'lucide-react';

interface School {
  id: string;
  name: string;
  slug: string;
  email_domains: string[];
  is_active: boolean;
  created_at: string;
  teacher_count: number;
}

interface SchoolTeacher {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  premium_status: boolean;
}

const RESERVED_SLUGS = [
  'admin', 'teacher', 'login', 'signup', 'api', 'auth', 'assets', 'functions',
  'dashboard', 'reports', 'analytics', 'admindashboard', 'teacherdashboard',
  'quiz', 'share', 'about', 'privacy', 'terms', 'contact', 'mission',
  'pricing', 'logout', 'success', 'global', 'reset-password', 'safeguarding',
  'ai-policy', 'signup-success', 'auth',
];

const FREE_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com'];

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12);
}

function validateSlug(slug: string): string | null {
  if (!slug) return 'Slug is required';
  if (slug.length < 2) return 'Slug must be at least 2 characters';
  if (slug.length > 12) return 'Slug must be 12 characters or fewer';
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) return 'Must start with a letter, only lowercase letters, numbers, hyphens';
  if (RESERVED_SLUGS.includes(slug)) return `"${slug}" is reserved and cannot be used`;
  return null;
}

function validateDomain(domain: string): string | null {
  const d = domain.trim().toLowerCase();
  if (!d) return null;
  if (d.startsWith('@')) return 'Do not include @ symbol';
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return `"${d}" is not a valid domain`;
  return null;
}

export default function AdminSchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const [showTeachersModal, setShowTeachersModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolTeachers, setSchoolTeachers] = useState<SchoolTeacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDomains, setFormDomains] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formForceFreeDomains, setFormForceFreeDomains] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const slugTouchedRef = useRef(false);

  useEffect(() => { fetchSchools(); }, []);

  async function fetchSchools() {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;

      const withCounts = await Promise.all(
        (data || []).map(async (s) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', s.id)
            .eq('role', 'teacher');
          return { ...s, teacher_count: count || 0 };
        })
      );
      setSchools(withCounts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingSchool(null);
    setFormName('');
    setFormSlug('');
    setFormDomains('');
    setFormActive(true);
    setFormForceFreeDomains(false);
    setFormError('');
    slugTouchedRef.current = false;
    setShowModal(true);
  }

  function openEdit(school: School) {
    setEditingSchool(school);
    setFormName(school.name);
    setFormSlug(school.slug || '');
    setFormDomains(school.email_domains.join(', '));
    setFormActive(school.is_active);
    setFormForceFreeDomains(false);
    setFormError('');
    slugTouchedRef.current = true;
    setShowModal(true);
  }

  function handleNameChange(val: string) {
    setFormName(val);
    if (!slugTouchedRef.current) {
      setFormSlug(normalizeSlug(val));
    }
  }

  async function handleSave() {
    setFormError('');
    const slug = normalizeSlug(formSlug);
    const slugErr = validateSlug(slug);
    if (slugErr) { setFormError(slugErr); return; }

    if (!formName.trim() || formName.trim().length < 3 || formName.trim().length > 80) {
      setFormError('School name must be 3-80 characters');
      return;
    }

    const rawDomains = formDomains.split(',').map(d => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
    const uniqueDomains = [...new Set(rawDomains)];

    if (uniqueDomains.length === 0) {
      setFormError('At least one email domain is required');
      return;
    }

    for (const d of uniqueDomains) {
      const domErr = validateDomain(d);
      if (domErr) { setFormError(domErr); return; }
    }

    const freeDomainFound = uniqueDomains.find(d => FREE_DOMAINS.includes(d));
    if (freeDomainFound && !formForceFreeDomains) {
      setFormError(`"${freeDomainFound}" is a free email domain. Check "Force allow free domains" to proceed.`);
      return;
    }

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      if (editingSchool) {
        const { error: updateErr } = await supabase
          .from('schools')
          .update({
            name: formName.trim(),
            slug,
            email_domains: uniqueDomains,
            is_active: formActive,
          })
          .eq('id', editingSchool.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('schools')
          .insert({
            name: formName.trim(),
            slug,
            email_domains: uniqueDomains,
            is_active: formActive,
            created_by: user.user.id,
          });
        if (insertErr) {
          if (insertErr.message.includes('duplicate') || insertErr.message.includes('unique')) {
            throw new Error(`Slug "${slug}" is already in use`);
          }
          throw insertErr;
        }
      }

      setShowModal(false);
      fetchSchools();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(school: School) {
    try {
      const { error: err } = await supabase
        .from('schools')
        .update({ is_active: !school.is_active })
        .eq('id', school.id);
      if (err) throw err;
      fetchSchools();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function copyWallUrl(slug: string) {
    navigator.clipboard.writeText(`https://startsprint.app/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  async function viewSchoolTeachers(school: School) {
    setSelectedSchool(school);
    setShowTeachersModal(true);
    setLoadingTeachers(true);

    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at')
        .eq('school_id', school.id)
        .eq('role', 'teacher')
        .order('created_at', { ascending: false });

      if (err) throw err;

      const teachersWithPremium = await Promise.all(
        (data || []).map(async (t) => {
          const { data: entitlement } = await supabase
            .from('teacher_entitlements')
            .select('status')
            .eq('teacher_user_id', t.id)
            .eq('status', 'active')
            .maybeSingle();

          return {
            ...t,
            premium_status: !!entitlement,
          };
        })
      );

      setSchoolTeachers(teachersWithPremium);
    } catch (err: any) {
      console.error('Error loading teachers:', err);
      setError(err.message);
    } finally {
      setLoadingTeachers(false);
    }
  }

  const filtered = schools.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.school_name.toLowerCase().includes(q) ||
      (s.slug || '').toLowerCase().includes(q) ||
      s.email_domains.some(d => d.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
          <p className="text-gray-600 mt-1">Manage schools, slugs, and allowed email domains</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-5 h-5" />
          Add School
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, slug, or domain..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Domains</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Teachers</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Active</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    {searchQuery ? 'No schools match your search' : 'No schools created yet'}
                  </td>
                </tr>
              ) : (
                filtered.map((school) => (
                  <tr key={school.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{school.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <code className="text-sm bg-gray-100 px-2 py-0.5 rounded font-mono text-blue-700">/{school.slug}</code>
                        <button
                          onClick={() => copyWallUrl(school.slug)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title="Copy wall URL"
                        >
                          {copiedSlug === school.slug ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={`/${school.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title="Open wall"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {school.email_domains.map((d, i) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono">{d}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {school.teacher_count > 0 ? (
                        <button
                          onClick={() => viewSchoolTeachers(school)}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          <Users className="w-3.5 h-3.5" />
                          {school.teacher_count}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                          <Users className="w-3.5 h-3.5" />
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(school)} title={school.is_active ? 'Deactivate' : 'Activate'}>
                        {school.is_active
                          ? <ToggleRight className="w-6 h-6 text-green-600" />
                          : <ToggleLeft className="w-6 h-6 text-gray-400" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(school.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(school)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">{editingSchool ? 'Edit School' : 'Add New School'}</h2>
            </div>

            <div className="px-6 py-5 space-y-5">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Northampton College"
                  maxLength={80}
                />
                <p className="text-xs text-gray-500 mt-1">{formName.length}/80 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL path)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">startsprint.app/</span>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => { slugTouchedRef.current = true; setFormSlug(normalizeSlug(e.target.value)); }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    placeholder="nc"
                    maxLength={12}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">2-12 chars, lowercase letters/numbers/hyphens, must start with a letter</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Email Domains</label>
                <input
                  type="text"
                  value={formDomains}
                  onChange={(e) => setFormDomains(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="northamptoncollege.ac.uk, nca.edu"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated. Teachers with these domains get auto-assigned and premium access.</p>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Active</label>
                <button onClick={() => setFormActive(!formActive)}>
                  {formActive ? <ToggleRight className="w-8 h-8 text-green-600" /> : <ToggleLeft className="w-8 h-8 text-gray-400" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Force allow free domains</label>
                <button onClick={() => setFormForceFreeDomains(!formForceFreeDomains)}>
                  {formForceFreeDomains ? <ToggleRight className="w-8 h-8 text-orange-500" /> : <ToggleLeft className="w-8 h-8 text-gray-400" />}
                </button>
              </div>

              {formSlug && !validateSlug(normalizeSlug(formSlug)) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <p className="font-medium mb-1">Wall URL:</p>
                  <code className="text-blue-700">https://startsprint.app/{normalizeSlug(formSlug)}</code>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
                {saving ? 'Saving...' : editingSchool ? 'Save Changes' : 'Create School'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTeachersModal && selectedSchool && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Teachers at {selectedSchool.school_name}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {schoolTeachers.length} teacher{schoolTeachers.length !== 1 ? 's' : ''} linked to this school
                </p>
              </div>
              <button
                onClick={() => setShowTeachersModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 flex-1 overflow-y-auto">
              {loadingTeachers ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : schoolTeachers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">No teachers found for this school</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Teachers will appear here when they sign up with an email matching this school's domains
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {schoolTeachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{teacher.full_name || 'Unnamed Teacher'}</div>
                          <div className="text-sm text-gray-600 font-mono">{teacher.email}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Joined: {new Date(teacher.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {teacher.premium_status ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                              <Check className="w-3 h-3" />
                              Premium
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                              Free
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div>
                  Allowed domains: {selectedSchool.email_domains.map((d, i) => (
                    <span key={i} className="font-mono text-blue-600">
                      {i > 0 ? ', ' : ''}@{d}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setShowTeachersModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
