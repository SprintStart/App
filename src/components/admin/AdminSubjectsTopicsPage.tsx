import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BookOpen, Plus, Edit2, Trash2, Check, X, AlertCircle, Hash, ToggleLeft, ToggleRight } from 'lucide-react';

interface Topic {
  id: string;
  name: string;
  slug: string;
  subject: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  question_count?: number;
}

const SUBJECTS = [
  'mathematics',
  'science',
  'english',
  'computing',
  'business',
  'geography',
  'history',
  'languages',
  'art',
  'engineering',
  'health',
  'other'
] as const;

export default function AdminSubjectsTopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [error, setError] = useState('');
  const [subjectStats, setSubjectStats] = useState<Record<string, { total: number; active: number }>>({});

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    subject: 'mathematics' as typeof SUBJECTS[number],
    description: '',
    cover_image_url: '',
    is_active: true,
    is_published: false,
  });

  useEffect(() => {
    fetchTopics();
    fetchSubjectStats();
  }, []);

  useEffect(() => {
    if (editingTopic) {
      setFormData({
        name: editingTopic.name,
        slug: editingTopic.slug,
        subject: editingTopic.subject as typeof SUBJECTS[number],
        description: editingTopic.description || '',
        cover_image_url: editingTopic.cover_image_url || '',
        is_active: editingTopic.is_active,
        is_published: editingTopic.is_published,
      });
    }
  }, [editingTopic]);

  async function fetchTopics() {
    try {
      setLoading(true);
      const { data: topicsData, error: topicsError } = await supabase
        .from('topics')
        .select('*')
        .order('subject')
        .order('name');

      if (topicsError) throw topicsError;

      const topicsWithCounts = await Promise.all(
        (topicsData || []).map(async (topic) => {
          // Get all question_sets for this topic
          const { data: questionSets } = await supabase
            .from('question_sets')
            .select('id')
            .eq('topic_id', topic.id);

          if (!questionSets || questionSets.length === 0) {
            return {
              ...topic,
              question_count: 0,
            };
          }

          // Count all questions in those question_sets
          const questionSetIds = questionSets.map(qs => qs.id);
          const { count } = await supabase
            .from('topic_questions')
            .select('*', { count: 'exact', head: true })
            .in('question_set_id', questionSetIds);

          return {
            ...topic,
            question_count: count || 0,
          };
        })
      );

      setTopics(topicsWithCounts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSubjectStats() {
    try {
      const stats: Record<string, { total: number; active: number }> = {};

      for (const subject of SUBJECTS) {
        const { count: total } = await supabase
          .from('topics')
          .select('*', { count: 'exact', head: true })
          .eq('subject', subject);

        const { count: active } = await supabase
          .from('topics')
          .select('*', { count: 'exact', head: true })
          .eq('subject', subject)
          .eq('is_active', true);

        stats[subject] = {
          total: total || 0,
          active: active || 0,
        };
      }

      setSubjectStats(stats);
    } catch (err: any) {
      console.error('Error fetching subject stats:', err);
    }
  }

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async function handleCreateTopic() {
    try {
      setError('');

      if (!formData.name || !formData.slug || !formData.subject) {
        setError('Name, slug, and subject are required');
        return;
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data: existingTopic } = await supabase
        .from('topics')
        .select('id')
        .eq('slug', formData.slug)
        .single();

      if (existingTopic) {
        setError('A topic with this slug already exists');
        return;
      }

      const { data: topic, error: topicError } = await supabase
        .from('topics')
        .insert({
          name: formData.name,
          slug: formData.slug,
          subject: formData.subject,
          description: formData.description || null,
          cover_image_url: formData.cover_image_url || null,
          is_active: formData.is_active,
          is_published: formData.is_published,
        })
        .select()
        .single();

      if (topicError) throw topicError;

      await supabase.from('audit_logs').insert({
        actor_email: user.user.email,
        action_type: 'topic_created',
        entity_type: 'topic',
        entity_id: topic.id,
        metadata: {
          name: formData.name,
          subject: formData.subject,
          slug: formData.slug,
        },
      });

      setShowCreateModal(false);
      resetForm();
      fetchTopics();
      fetchSubjectStats();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleUpdateTopic() {
    if (!editingTopic) return;

    try {
      setError('');

      if (!formData.name || !formData.slug || !formData.subject) {
        setError('Name, slug, and subject are required');
        return;
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data: existingTopic } = await supabase
        .from('topics')
        .select('id')
        .eq('slug', formData.slug)
        .neq('id', editingTopic.id)
        .single();

      if (existingTopic) {
        setError('Another topic with this slug already exists');
        return;
      }

      const { error: updateError } = await supabase
        .from('topics')
        .update({
          name: formData.name,
          slug: formData.slug,
          subject: formData.subject,
          description: formData.description || null,
          cover_image_url: formData.cover_image_url || null,
          is_active: formData.is_active,
          is_published: formData.is_published,
        })
        .eq('id', editingTopic.id);

      if (updateError) throw updateError;

      await supabase.from('audit_logs').insert({
        actor_email: user.user.email,
        action_type: 'topic_updated',
        entity_type: 'topic',
        entity_id: editingTopic.id,
        metadata: {
          name: formData.name,
          subject: formData.subject,
          changes: {
            name: editingTopic.name !== formData.name,
            slug: editingTopic.slug !== formData.slug,
            subject: editingTopic.subject !== formData.subject,
            is_active: editingTopic.is_active !== formData.is_active,
          },
        },
      });

      setShowEditModal(false);
      setEditingTopic(null);
      resetForm();
      fetchTopics();
      fetchSubjectStats();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleTopicStatus(topic: Topic) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('topics')
        .update({ is_active: !topic.is_active })
        .eq('id', topic.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        actor_email: user.user.email,
        action_type: topic.is_active ? 'topic_deactivated' : 'topic_activated',
        entity_type: 'topic',
        entity_id: topic.id,
        metadata: {
          name: topic.name,
          subject: topic.subject,
          slug: topic.slug,
        },
      });

      fetchTopics();
      fetchSubjectStats();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function togglePublishStatus(topic: Topic) {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('topics')
        .update({ is_published: !topic.is_published })
        .eq('id', topic.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        actor_email: user.user.email,
        action_type: topic.is_published ? 'topic_unpublished' : 'topic_published',
        entity_type: 'topic',
        entity_id: topic.id,
        metadata: {
          name: topic.name,
          subject: topic.subject,
          slug: topic.slug,
          is_published: !topic.is_published,
        },
      });

      fetchTopics();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function deleteTopic(topic: Topic) {
    if (!confirm(`Are you sure you want to delete "${topic.name}"? This will also delete all associated questions.`)) {
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', topic.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        actor_email: user.user.email,
        action_type: 'topic_deleted',
        entity_type: 'topic',
        entity_id: topic.id,
        metadata: {
          name: topic.name,
          subject: topic.subject,
          slug: topic.slug,
          question_count: topic.question_count,
        },
      });

      fetchTopics();
      fetchSubjectStats();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      slug: '',
      subject: 'mathematics',
      description: '',
      cover_image_url: '',
      is_active: true,
      is_published: false,
    });
  }

  const filteredTopics = selectedSubject === 'all'
    ? topics
    : topics.filter(t => t.subject === selectedSubject);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subjects & Topics</h1>
          <p className="text-gray-600 mt-1">Manage curriculum structure and content areas</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add Topic
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setSelectedSubject('all')}
          className={`p-3 rounded-lg border-2 text-center transition-all ${
            selectedSubject === 'all'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="font-semibold text-gray-900">All Subjects</div>
          <div className="text-sm text-gray-600 mt-1">{topics.length} topics</div>
        </button>

        {SUBJECTS.map((subject) => {
          const stats = subjectStats[subject] || { total: 0, active: 0 };
          return (
            <button
              key={subject}
              onClick={() => setSelectedSubject(subject)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                selectedSubject === subject
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold text-gray-900 capitalize">{subject}</div>
              <div className="text-sm text-gray-600 mt-1">
                {stats.total} topics ({stats.active} active)
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedSubject === 'all' ? 'All Topics' : `${selectedSubject.charAt(0).toUpperCase() + selectedSubject.slice(1)} Topics`}
            <span className="text-gray-500 font-normal ml-2">({filteredTopics.length})</span>
          </h2>
        </div>

        {filteredTopics.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No topics found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first topic
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTopics.map((topic) => (
              <div key={topic.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{topic.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        topic.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {topic.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        topic.is_published
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {topic.is_published ? 'Published' : 'Draft'}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 capitalize">
                        {topic.subject}
                      </span>
                    </div>

                    <div className="mt-1 text-sm text-gray-600 space-y-1">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs">{topic.slug}</span>
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {topic.question_count || 0} questions
                        </span>
                      </div>
                      {topic.description && (
                        <p className="text-gray-500">{topic.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePublishStatus(topic)}
                      className={`px-3 py-1 text-sm rounded ${
                        topic.is_published
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      }`}
                      title={topic.is_published ? 'Unpublish (hide from students)' : 'Publish (show to students)'}
                    >
                      {topic.is_published ? 'Published' : 'Draft'}
                    </button>
                    <button
                      onClick={() => toggleTopicStatus(topic)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                      title={topic.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {topic.is_active ? (
                        <ToggleRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingTopic(topic);
                        setShowEditModal(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit topic"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTopic(topic)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete topic"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {showCreateModal ? 'Create New Topic' : `Edit Topic: ${editingTopic?.name}`}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Topic Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setFormData({
                        ...formData,
                        name: newName,
                        slug: showCreateModal ? generateSlug(newName) : formData.slug,
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Algebra Basics"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug * (URL-friendly)
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="algebra-basics"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Brief description of this topic..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject *
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value as typeof SUBJECTS[number] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 capitalize"
                  >
                    {SUBJECTS.map(subject => (
                      <option key={subject} value={subject} className="capitalize">
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cover Image URL
                  </label>
                  <input
                    type="text"
                    value={formData.cover_image_url}
                    onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    Topic is active (can be managed and edited)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_published"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="is_published" className="text-sm text-gray-700">
                    <span className="font-semibold">Published</span> (visible to students on the platform)
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingTopic(null);
                  resetForm();
                  setError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreateTopic : handleUpdateTopic}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {showCreateModal ? 'Create Topic' : 'Update Topic'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
