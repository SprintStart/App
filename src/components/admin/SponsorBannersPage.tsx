import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Megaphone, Plus, Eye, MousePointer, BarChart3, Trash2, Edit, Play, Pause, Upload, X, Download } from 'lucide-react';

interface SponsorBanner {
  id: string;
  title: string;
  image_url: string;
  destination_url: string;
  placement: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  sponsor_name?: string;
  description?: string;
}

interface BannerAnalytics {
  banner_id: string;
  banner_title: string;
  impressions: number;
  clicks: number;
  ctr: number;
  placement: string;
}

export function SponsorBannersPage() {
  const [banners, setBanners] = useState<SponsorBanner[]>([]);
  const [analytics, setAnalytics] = useState<BannerAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<SponsorBanner | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    destination_url: '',
    placement: 'homepage-top',
    start_date: '',
    end_date: '',
    sponsor_name: '',
    description: '',
  });

  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('ad-banners')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ad-banners')
        .getPublicUrl(filePath);

      setUploadedImageUrl(publicUrl);
      setFormData({ ...formData, image_url: publicUrl });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  }

  async function downloadSponsorReport(adId: string, adTitle: string, days: number = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase.rpc('admin_get_sponsor_report', {
        p_ad_id: adId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

      if (error) throw error;

      const csvContent = generateCSVReport(data, adTitle);

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `sponsor-report-${adTitle.replace(/\s+/g, '-')}-${days}days.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report');
    }
  }

  function generateCSVReport(data: any, adTitle: string): string {
    const metrics = data.metrics || {};
    const adInfo = data.ad_info || {};
    const topPages = data.top_pages || [];
    const dailyBreakdown = data.daily_breakdown || [];

    let csv = 'Sponsor Ad Report\n\n';
    csv += `Ad Title,${adTitle}\n`;
    csv += `Sponsor,${adInfo.sponsor_name || 'N/A'}\n`;
    csv += `Placement,${adInfo.placement || 'N/A'}\n`;
    csv += `Date Range,${data.date_range?.start} to ${data.date_range?.end}\n\n`;

    csv += 'Summary Metrics\n';
    csv += `Total Impressions,${metrics.impressions || 0}\n`;
    csv += `Total Clicks,${metrics.clicks || 0}\n`;
    csv += `CTR,%${metrics.ctr || 0}\n`;
    csv += `Unique Sessions,${metrics.unique_sessions || 0}\n\n`;

    csv += 'Top Pages by Impressions\n';
    csv += 'Page,Impressions\n';
    topPages.forEach((page: any) => {
      csv += `${page.page},${page.impressions}\n`;
    });

    csv += '\nDaily Breakdown\n';
    csv += 'Date,Impressions,Clicks\n';
    dailyBreakdown.forEach((day: any) => {
      csv += `${day.date},${day.impressions},${day.clicks}\n`;
    });

    return csv;
  }

  async function loadBanners() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sponsored_ads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBanners(data || []);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const analyticsResponse = await fetch(
        `${supabaseUrl}/functions/v1/sponsor-analytics?action=report&days=7`
      );

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData.analytics || []);
      }
    } catch (error) {
      console.error('Error loading banners:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        title: formData.title,
        image_url: formData.image_url,
        destination_url: formData.destination_url,
        placement: formData.placement,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        sponsor_name: formData.sponsor_name || null,
        description: formData.description || null,
        is_active: true,
        created_by: user.id,
      };

      if (editingBanner) {
        const { error } = await supabase
          .from('sponsored_ads')
          .update(payload)
          .eq('id', editingBanner.id);

        if (error) throw error;
      } else {
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
        destination_url: '',
        placement: 'homepage-top',
        start_date: '',
        end_date: '',
        sponsor_name: '',
        description: '',
      });
      setUploadedImageUrl('');
      setImageMode('url');
      await loadBanners();
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('Failed to save banner. Please try again.');
    }
  }

  async function toggleBannerStatus(banner: SponsorBanner) {
    try {
      const { error } = await supabase
        .from('sponsored_ads')
        .update({ is_active: !banner.is_active })
        .eq('id', banner.id);

      if (error) throw error;
      await loadBanners();
    } catch (error) {
      console.error('Error toggling banner:', error);
    }
  }

  async function deleteBanner(id: string) {
    if (!confirm('Are you sure you want to delete this banner?')) return;

    try {
      const { error } = await supabase
        .from('sponsored_ads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
    }
  }

  function startEdit(banner: SponsorBanner) {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      image_url: banner.image_url,
      destination_url: banner.destination_url,
      placement: banner.placement,
      start_date: banner.start_date?.split('T')[0] || '',
      end_date: banner.end_date?.split('T')[0] || '',
    });
    setShowForm(true);
  }

  useEffect(() => {
    loadBanners();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading banners...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Sponsored Banners</h3>
            <p className="text-gray-600 mt-1">Manage sponsored ad banners across the platform</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingBanner(null);
              setFormData({
                title: '',
                image_url: '',
                destination_url: '',
                placement: 'homepage-top',
                start_date: '',
                end_date: '',
              });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Cancel' : 'New Banner'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-6 bg-gray-50 rounded-lg space-y-4">
            <h4 className="font-semibold text-gray-900">
              {editingBanner ? 'Edit Banner' : 'Create New Banner'}
            </h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Banner Image
              </label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setImageMode('upload')}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    imageMode === 'upload'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload Image
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode('url')}
                  className={`px-4 py-2 rounded-lg ${
                    imageMode === 'url'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Enter URL
                </button>
              </div>

              {imageMode === 'upload' ? (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {uploading && (
                    <p className="text-sm text-gray-500 mt-2">Uploading...</p>
                  )}
                  {uploadedImageUrl && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700">Image uploaded successfully</p>
                      <img src={uploadedImageUrl} alt="Uploaded" className="mt-2 max-h-32 rounded" />
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  required
                  placeholder="https://example.com/banner.jpg"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sponsor Name (Optional)
              </label>
              <input
                type="text"
                value={formData.sponsor_name}
                onChange={(e) => setFormData({ ...formData, sponsor_name: e.target.value })}
                placeholder="e.g., Acme Corporation"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Internal Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Internal notes about this banner..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination URL
              </label>
              <input
                type="url"
                value={formData.destination_url}
                onChange={(e) => setFormData({ ...formData, destination_url: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placement
              </label>
              <select
                value={formData.placement}
                onChange={(e) => setFormData({ ...formData, placement: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="homepage-top">Homepage Top</option>
                <option value="homepage-bottom">Homepage Bottom</option>
                <option value="quiz-end">Quiz End</option>
                <option value="sidebar">Sidebar</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {formData.image_url && (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Preview Banner
              </button>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingBanner ? 'Update Banner' : 'Create Banner'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingBanner(null);
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {banners.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No banners created yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {banners.map((banner) => {
              const stats = analytics.find(a => a.banner_id === banner.id);

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
                          <h4 className="font-semibold text-gray-900">{banner.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{banner.destination_url}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="capitalize">{banner.placement.replace('-', ' ')}</span>
                            {banner.start_date && (
                              <span>Starts: {new Date(banner.start_date).toLocaleDateString()}</span>
                            )}
                            {banner.end_date && (
                              <span>Ends: {new Date(banner.end_date).toLocaleDateString()}</span>
                            )}
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
                            title={banner.is_active ? 'Pause' : 'Activate'}
                          >
                            {banner.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => startEdit(banner)}
                            className="p-2 text-blue-600 hover:text-blue-700 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadSponsorReport(banner.id, banner.title, 30)}
                            className="p-2 text-green-600 hover:text-green-700 rounded"
                            title="Download 30-day Report"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteBanner(banner.id)}
                            className="p-2 text-red-600 hover:text-red-700 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {stats && (
                        <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-2 text-sm">
                            <Eye className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{stats.impressions}</span>
                            <span className="text-gray-500">views</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <MousePointer className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{stats.clicks}</span>
                            <span className="text-gray-500">clicks</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <BarChart3 className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{stats.ctr.toFixed(2)}%</span>
                            <span className="text-gray-500">CTR</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Banner Preview</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Placement: {formData.placement.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Homepage Top</h4>
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4">
                    {formData.placement === 'homepage-top' && (
                      <img
                        src={formData.image_url}
                        alt={formData.title}
                        className="w-full h-auto rounded-lg shadow-sm"
                      />
                    )}
                    {formData.placement !== 'homepage-top' && (
                      <p className="text-center text-gray-400 py-8">Not displayed in this placement</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Homepage Bottom</h4>
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4">
                    {formData.placement === 'homepage-bottom' && (
                      <img
                        src={formData.image_url}
                        alt={formData.title}
                        className="w-full h-auto rounded-lg shadow-sm"
                      />
                    )}
                    {formData.placement !== 'homepage-bottom' && (
                      <p className="text-center text-gray-400 py-8">Not displayed in this placement</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Quiz End</h4>
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4">
                    {formData.placement === 'quiz-end' && (
                      <img
                        src={formData.image_url}
                        alt={formData.title}
                        className="w-full h-auto max-w-2xl mx-auto rounded-lg shadow-sm"
                      />
                    )}
                    {formData.placement !== 'quiz-end' && (
                      <p className="text-center text-gray-400 py-8">Not displayed in this placement</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Sidebar</h4>
                  <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 max-w-xs">
                    {formData.placement === 'sidebar' && (
                      <img
                        src={formData.image_url}
                        alt={formData.title}
                        className="w-full h-auto rounded-lg shadow-sm"
                      />
                    )}
                    {formData.placement !== 'sidebar' && (
                      <p className="text-center text-gray-400 py-8">Not displayed in this placement</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
