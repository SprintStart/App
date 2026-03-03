import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Megaphone, Plus, Eye, MousePointer, BarChart3, Trash2, Edit, Play, Pause, Upload, X, Download, Globe, MapPin, School } from 'lucide-react';

interface SponsorBanner {
  id: string;
  title: string;
  image_url: string;
  destination_url?: string;
  click_url?: string;
  placement: string;
  scope: string;
  country_id: string | null;
  exam_system_id: string | null;
  school_id: string | null;
  priority: number;
  weight: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  impression_count: number;
  click_count: number;
  created_at: string;
  sponsor_name?: string;
  description?: string;
}

interface Country {
  id: string;
  name: string;
  slug: string;
}

interface ExamSystem {
  id: string;
  name: string;
  slug: string;
  country_id: string;
}

interface School {
  id: string;
  name: string;
  slug: string;
}

interface BulkAdDraft {
  file: File;
  preview: string;
  title: string;
  click_url: string;
  scope: string;
  country_id: string | null;
  exam_system_id: string | null;
  school_id: string | null;
  placement: string;
  priority: number;
  weight: number;
  start_date: string;
  end_date: string;
  sponsor_name: string;
}

export function SponsorBannersPageV2() {
  const [banners, setBanners] = useState<SponsorBanner[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [examSystems, setExamSystems] = useState<ExamSystem[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingBanner, setEditingBanner] = useState<SponsorBanner | null>(null);
  const [bulkDrafts, setBulkDrafts] = useState<BulkAdDraft[]>([]);
  const [uploading, setUploading] = useState(false);

  const [filterScope, setFilterScope] = useState<string>('ALL');
  const [filterCountry, setFilterCountry] = useState<string>('ALL');
  const [filterPlacement, setFilterPlacement] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    click_url: '',
    scope: 'GLOBAL',
    country_id: '',
    exam_system_id: '',
    school_id: '',
    placement: 'GLOBAL_HOME',
    priority: 100,
    weight: 1,
    start_date: '',
    end_date: '',
    sponsor_name: '',
    description: '',
  });

  async function loadData() {
    setLoading(true);
    try {
      const [bannersRes, countriesRes, examSystemsRes, schoolsRes] = await Promise.all([
        supabase.from('sponsored_ads').select('*').order('created_at', { ascending: false }),
        supabase.from('countries').select('id, name, slug').order('name'),
        supabase.from('exam_systems').select('id, name, slug, country_id').order('name'),
        supabase.from('schools').select('id, name, slug').order('name'),
      ]);

      if (bannersRes.error) throw bannersRes.error;
      if (countriesRes.error) throw countriesRes.error;
      if (examSystemsRes.error) throw examSystemsRes.error;
      if (schoolsRes.error) throw schoolsRes.error;

      setBanners(bannersRes.data || []);
      setCountries(countriesRes.data || []);
      setExamSystems(examSystemsRes.data || []);
      setSchools(schoolsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length > 100) {
      alert('Maximum 100 images at once');
      return;
    }

    const validFiles = files.filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
    if (validFiles.length !== files.length) {
      alert('Some files were skipped (not images or > 5MB)');
    }

    const drafts: BulkAdDraft[] = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      click_url: '',
      scope: 'GLOBAL',
      country_id: null,
      exam_system_id: null,
      school_id: null,
      placement: 'GLOBAL_HOME',
      priority: 100,
      weight: 1,
      start_date: '',
      end_date: '',
      sponsor_name: '',
    }));

    setBulkDrafts(drafts);
    setShowBulkUpload(true);
  }

  async function uploadBulkAds() {
    if (bulkDrafts.length === 0) return;

    const incompleteAds = bulkDrafts.filter(d => !d.click_url.trim());
    if (incompleteAds.length > 0) {
      alert(`${incompleteAds.length} ads are missing click URLs`);
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      for (const draft of bulkDrafts) {
        const fileExt = draft.file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('ad-banners')
          .upload(fileName, draft.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('ad-banners')
          .getPublicUrl(fileName);

        const adData = {
          title: draft.title,
          image_url: publicUrl,
          destination_url: draft.click_url,
          scope: draft.scope,
          country_id: draft.country_id || null,
          exam_system_id: draft.exam_system_id || null,
          school_id: draft.school_id || null,
          placement: draft.placement,
          priority: draft.priority,
          weight: draft.weight,
          start_date: draft.start_date || null,
          end_date: draft.end_date || null,
          sponsor_name: draft.sponsor_name || null,
          is_active: true,
          created_by: user.id,
        };

        const { error: insertError } = await supabase
          .from('sponsored_ads')
          .insert(adData);

        if (insertError) throw insertError;
      }

      alert(`${bulkDrafts.length} ads created successfully!`);
      setBulkDrafts([]);
      setShowBulkUpload(false);
      await loadData();
    } catch (error) {
      console.error('Error uploading bulk ads:', error);
      alert('Failed to upload some ads. Check console for details.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload: any = {
        title: formData.title,
        image_url: formData.image_url,
        destination_url: formData.click_url,
        scope: formData.scope,
        placement: formData.placement,
        priority: formData.priority,
        weight: formData.weight,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        sponsor_name: formData.sponsor_name || null,
        description: formData.description || null,
        is_active: true,
      };

      if (formData.scope === 'GLOBAL') {
        payload.country_id = null;
        payload.exam_system_id = null;
        payload.school_id = null;
      } else if (formData.scope === 'COUNTRY') {
        if (!formData.country_id) {
          alert('Country required for COUNTRY scope');
          return;
        }
        payload.country_id = formData.country_id;
        payload.exam_system_id = formData.exam_system_id || null;
        payload.school_id = null;
      } else if (formData.scope === 'SCHOOL') {
        if (!formData.school_id) {
          alert('School required for SCHOOL scope');
          return;
        }
        payload.school_id = formData.school_id;
        payload.country_id = null;
        payload.exam_system_id = null;
      }

      if (editingBanner) {
        const { error } = await supabase
          .from('sponsored_ads')
          .update(payload)
          .eq('id', editingBanner.id);

        if (error) throw error;
      } else {
        payload.created_by = user.id;
        const { error } = await supabase
          .from('sponsored_ads')
          .insert(payload);

        if (error) throw error;
      }

      setShowForm(false);
      setEditingBanner(null);
      setFormData({
        title: '',
        image_url: '',
        click_url: '',
        scope: 'GLOBAL',
        country_id: '',
        exam_system_id: '',
        school_id: '',
        placement: 'GLOBAL_HOME',
        priority: 100,
        weight: 1,
        start_date: '',
        end_date: '',
        sponsor_name: '',
        description: '',
      });
      await loadData();
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('Failed to save banner');
    }
  }

  async function toggleBannerStatus(banner: SponsorBanner) {
    try {
      const { error } = await supabase
        .from('sponsored_ads')
        .update({ is_active: !banner.is_active })
        .eq('id', banner.id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error toggling banner:', error);
    }
  }

  async function deleteBanner(id: string) {
    if (!confirm('Delete this banner?')) return;

    try {
      const { error } = await supabase
        .from('sponsored_ads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting banner:', error);
    }
  }

  function startEdit(banner: SponsorBanner) {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      image_url: banner.image_url,
      click_url: banner.destination_url || banner.click_url || '',
      scope: banner.scope || 'GLOBAL',
      country_id: banner.country_id || '',
      exam_system_id: banner.exam_system_id || '',
      school_id: banner.school_id || '',
      placement: banner.placement,
      priority: banner.priority || 100,
      weight: banner.weight || 1,
      start_date: banner.start_date?.split('T')[0] || '',
      end_date: banner.end_date?.split('T')[0] || '',
      sponsor_name: banner.sponsor_name || '',
      description: banner.description || '',
    });
    setShowForm(true);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredBanners = banners.filter(b => {
    if (filterScope !== 'ALL' && b.scope !== filterScope) return false;
    if (filterCountry !== 'ALL' && b.country_id !== filterCountry) return false;
    if (filterPlacement !== 'ALL' && b.placement !== filterPlacement) return false;
    if (filterStatus === 'ACTIVE' && !b.is_active) return false;
    if (filterStatus === 'INACTIVE' && b.is_active) return false;
    return true;
  });

  const getScopeIcon = (scope: string) => {
    if (scope === 'GLOBAL') return <Globe className="w-4 h-4" />;
    if (scope === 'COUNTRY') return <MapPin className="w-4 h-4" />;
    if (scope === 'SCHOOL') return <School className="w-4 h-4" />;
    return null;
  };

  const getScopeBadgeColor = (scope: string) => {
    if (scope === 'GLOBAL') return 'bg-blue-100 text-blue-700';
    if (scope === 'COUNTRY') return 'bg-green-100 text-green-700';
    if (scope === 'SCHOOL') return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Sponsored Ads</h3>
            <p className="text-gray-600 mt-1">Geo-targeted ads with bulk upload</p>
          </div>
          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Bulk Upload
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleBulkImageUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditingBanner(null);
                setFormData({
                  title: '',
                  image_url: '',
                  click_url: '',
                  scope: 'GLOBAL',
                  country_id: '',
                  exam_system_id: '',
                  school_id: '',
                  placement: 'GLOBAL_HOME',
                  priority: 100,
                  weight: 1,
                  start_date: '',
                  end_date: '',
                  sponsor_name: '',
                  description: '',
                });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {showForm ? 'Cancel' : 'New Ad'}
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="ALL">All Scopes</option>
            <option value="GLOBAL">Global</option>
            <option value="COUNTRY">Country</option>
            <option value="SCHOOL">School</option>
          </select>

          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="ALL">All Countries</option>
            {countries.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filterPlacement}
            onChange={(e) => setFilterPlacement(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="ALL">All Placements</option>
            <option value="GLOBAL_HOME">Global Home</option>
            <option value="COUNTRY_HOME">Country Home</option>
            <option value="QUIZ_PLAY">Quiz Play</option>
            <option value="QUIZ_END">Quiz End</option>
            <option value="SIDEBAR">Sidebar</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-6 bg-gray-50 rounded-lg space-y-4">
            <h4 className="font-semibold text-gray-900">
              {editingBanner ? 'Edit Ad' : 'Create New Ad'}
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Click URL</label>
                <input
                  type="url"
                  value={formData.click_url}
                  onChange={(e) => setFormData({ ...formData, click_url: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                <select
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value, country_id: '', school_id: '' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="GLOBAL">Global</option>
                  <option value="COUNTRY">Country</option>
                  <option value="SCHOOL">School</option>
                </select>
              </div>

              {formData.scope === 'COUNTRY' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <select
                      value={formData.country_id}
                      onChange={(e) => setFormData({ ...formData, country_id: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select Country</option>
                      {countries.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exam (Optional)</label>
                    <select
                      value={formData.exam_system_id}
                      onChange={(e) => setFormData({ ...formData, exam_system_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Any Exam</option>
                      {examSystems.filter(e => e.country_id === formData.country_id).map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {formData.scope === 'SCHOOL' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
                  <select
                    value={formData.school_id}
                    onChange={(e) => setFormData({ ...formData, school_id: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select School</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Placement</label>
                <select
                  value={formData.placement}
                  onChange={(e) => setFormData({ ...formData, placement: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="GLOBAL_HOME">Global Home</option>
                  <option value="COUNTRY_HOME">Country Home</option>
                  <option value="QUIZ_PLAY">Quiz Play</option>
                  <option value="QUIZ_END">Quiz End</option>
                  <option value="SIDEBAR">Sidebar</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingBanner ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingBanner(null); }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {filteredBanners.map((banner) => {
            const country = countries.find(c => c.id === banner.country_id);
            const ctr = banner.impression_count > 0
              ? ((banner.click_count / banner.impression_count) * 100).toFixed(2)
              : '0.00';

            return (
              <div
                key={banner.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-32 h-20 object-cover rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{banner.title}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${getScopeBadgeColor(banner.scope)}`}>
                            {getScopeIcon(banner.scope)}
                            {banner.scope}
                            {country && ` • ${country.name}`}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{banner.destination_url || banner.click_url}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>{banner.placement.replace('_', ' ')}</span>
                          <span>P:{banner.priority}</span>
                          <span>W:{banner.weight}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            banner.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {banner.is_active ? 'Active' : 'Paused'}
                        </span>
                        <button
                          onClick={() => toggleBannerStatus(banner)}
                          className="p-2 text-gray-600 hover:text-gray-900 rounded"
                        >
                          {banner.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => startEdit(banner)}
                          className="p-2 text-blue-600 hover:text-blue-700 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteBanner(banner.id)}
                          className="p-2 text-red-600 hover:text-red-700 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-sm">
                        <Eye className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{banner.impression_count}</span>
                        <span className="text-gray-500">impressions</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MousePointer className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{banner.click_count}</span>
                        <span className="text-gray-500">clicks</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <BarChart3 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{ctr}%</span>
                        <span className="text-gray-500">CTR</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showBulkUpload && bulkDrafts.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Bulk Upload - {bulkDrafts.length} Ads</h3>
                <p className="text-sm text-gray-600">Configure each ad before uploading</p>
              </div>
              <button
                onClick={() => {
                  setBulkDrafts([]);
                  setShowBulkUpload(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {bulkDrafts.map((draft, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex gap-4">
                    <img src={draft.preview} alt="" className="w-24 h-16 object-cover rounded" />
                    <div className="flex-1 grid grid-cols-6 gap-2">
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => {
                          const updated = [...bulkDrafts];
                          updated[idx].title = e.target.value;
                          setBulkDrafts(updated);
                        }}
                        placeholder="Title"
                        className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="url"
                        value={draft.click_url}
                        onChange={(e) => {
                          const updated = [...bulkDrafts];
                          updated[idx].click_url = e.target.value;
                          setBulkDrafts(updated);
                        }}
                        placeholder="Click URL (required)"
                        className="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <select
                        value={draft.scope}
                        onChange={(e) => {
                          const updated = [...bulkDrafts];
                          updated[idx].scope = e.target.value;
                          updated[idx].country_id = null;
                          updated[idx].school_id = null;
                          setBulkDrafts(updated);
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="GLOBAL">Global</option>
                        <option value="COUNTRY">Country</option>
                        <option value="SCHOOL">School</option>
                      </select>

                      {draft.scope === 'COUNTRY' && (
                        <select
                          value={draft.country_id || ''}
                          onChange={(e) => {
                            const updated = [...bulkDrafts];
                            updated[idx].country_id = e.target.value;
                            setBulkDrafts(updated);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">Select Country</option>
                          {countries.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}

                      {draft.scope === 'SCHOOL' && (
                        <select
                          value={draft.school_id || ''}
                          onChange={(e) => {
                            const updated = [...bulkDrafts];
                            updated[idx].school_id = e.target.value;
                            setBulkDrafts(updated);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">Select School</option>
                          {schools.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      )}

                      <select
                        value={draft.placement}
                        onChange={(e) => {
                          const updated = [...bulkDrafts];
                          updated[idx].placement = e.target.value;
                          setBulkDrafts(updated);
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="GLOBAL_HOME">Global Home</option>
                        <option value="COUNTRY_HOME">Country Home</option>
                        <option value="QUIZ_PLAY">Quiz Play</option>
                        <option value="QUIZ_END">Quiz End</option>
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        setBulkDrafts(bulkDrafts.filter((_, i) => i !== idx));
                      }}
                      className="p-2 text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => {
                    setBulkDrafts([]);
                    setShowBulkUpload(false);
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={uploadBulkAds}
                  disabled={uploading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : `Create ${bulkDrafts.length} Ads`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
