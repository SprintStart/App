import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Save, Loader2, KeyRound } from 'lucide-react';

export function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [school, setSchool] = useState('');
  const [subjects, setSubjects] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      setEmail(user.user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, school_name, subjects_taught')
        .eq('id', user.user.id)
        .maybeSingle();

      if (profile) {
        setFullName(profile.full_name || '');
        setSchool(profile.school_name || '');
        setSubjects(profile.subjects_taught?.join(', ') || '');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const subjectsArray = subjects
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          school_name: school,
          subjects_taught: subjectsArray,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.user.id);

      await supabase.from('teacher_activities').insert({
        teacher_id: user.user.id,
        activity_type: 'profile_updated',
        title: 'Profile updated'
      });

      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Failed to save profile:', err);
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      alert('Password reset email sent! Check your inbox.');
    } catch (err) {
      console.error('Failed to send password reset:', err);
      alert('Failed to send password reset email');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-gray-200">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Teacher Account</h2>
            <p className="text-sm text-gray-600">{email}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">School / Institution</label>
          <input
            type="text"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="Enter your school name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subjects Taught
          </label>
          <input
            type="text"
            value={subjects}
            onChange={(e) => setSubjects(e.target.value)}
            placeholder="e.g., Mathematics, Science, English (comma-separated)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Separate multiple subjects with commas</p>
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Changes
            </>
          )}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Security</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Password</p>
            <p className="text-sm text-gray-600">Last changed recently</p>
          </div>
          <button
            onClick={sendPasswordReset}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            Reset Password
          </button>
        </div>
      </div>
    </div>
  );
}
