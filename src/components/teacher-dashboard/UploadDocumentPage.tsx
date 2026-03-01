import { useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { authenticatedPost } from '../../lib/authenticatedFetch';

interface QuizFormData {
  subject: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}

export function UploadDocumentPage() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [formData, setFormData] = useState<QuizFormData>({
    subject: 'Mathematics',
    topic: '',
    difficulty: 'medium',
    count: 10
  });

  // Feature flag: Document processing is coming soon
  const DOCUMENT_PROCESSING_ENABLED = false;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }

  async function handleUpload() {
    // FEATURE DISABLED - No backend calls
    if (!DOCUMENT_PROCESSING_ENABLED) {
      // Do nothing - button should be disabled anyway
      return;
    }

    // Below code will never execute while feature is disabled
    // Keeping for future implementation
    if (!file && !pastedText.trim()) {
      setError('Please select a file or paste text');
      return;
    }

    if (!formData.topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setUploading(true);
    setError('');

    try {
      let fileData = '';
      let fileName = 'pasted-text.txt';
      let fileType = 'text/plain';

      if (file) {
        fileData = await fileToBase64(file);
        fileName = file.name;
        fileType = file.type;
      } else {
        // Convert pasted text to base64
        fileData = btoa(pastedText);
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document-upload`;
      const { data: result, error: uploadError } = await authenticatedPost(apiUrl, {
        fileName,
        fileType,
        fileData,
        subject: formData.subject,
        topic: formData.topic,
        difficulty: formData.difficulty,
        count: formData.count
      });

      if (uploadError) {
        throw uploadError;
      }

      if (result) {
        alert(`Success! Generated ${result.items.length} questions from your document. Redirecting to quiz creation...`);

        // Navigate to create quiz with generated questions
        navigate('/teacher/create-quiz', {
          state: {
            generatedQuestions: result.items,
            subject: formData.subject,
            topic: formData.topic
          }
        });
      }

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to process document');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Upload className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Document</h1>
        <p className="text-gray-600">Generate quizzes from your teaching materials</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select File</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition">
            <input
              type="file"
              id="file-upload"
              accept=".pdf,.doc,.docx,.txt,.rtf"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {file ? (
                <div className="space-y-3">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
                  <div>
                    <p className="font-semibold text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setFile(null);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Choose a different file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <FileText className="w-12 h-12 mx-auto text-gray-400" />
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">Choose File</p>
                    <p className="text-xs text-gray-400">PDF, Word, or Text (Max 10MB)</p>
                  </div>
                </div>
              )}
            </label>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500 font-medium">Or Paste Text</div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Paste Text</label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            disabled={uploading || !!file}
            placeholder="Paste your teaching materials here..."
            className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              disabled={uploading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              disabled={uploading}
              placeholder="e.g., Quadratic Equations"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
              disabled={uploading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Question Count</label>
            <input
              type="number"
              value={formData.count}
              onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) || 10 })}
              disabled={uploading}
              min="5"
              max="50"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Coming Soon Banner */}
        {!DOCUMENT_PROCESSING_ENABLED && (
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">Coming Soon!</p>
              <p className="text-sm text-blue-800">
                Document processing will extract text and generate questions automatically.
                For now, please use the Manual quiz builder.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!DOCUMENT_PROCESSING_ENABLED || uploading || (!file && !pastedText.trim())}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title={!DOCUMENT_PROCESSING_ENABLED ? "Coming soon - Document processing will extract text and generate questions" : ""}
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing Document & Generating Questions...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Process Document & Generate Questions {!DOCUMENT_PROCESSING_ENABLED && "(Coming Soon)"}
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          {DOCUMENT_PROCESSING_ENABLED
            ? "We'll extract key concepts and generate questions that you can review and edit."
            : "This feature is under development. Use the Manual tab to create questions now."}
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-blue-900">How it works</h3>
        <ol className="text-sm text-blue-800 space-y-2">
          <li className="flex gap-3">
            <span className="font-bold">1.</span>
            <span>Upload a document (Word, PDF, TXT) or paste your teaching materials</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold">2.</span>
            <span>AI extracts text and generates quiz questions based on content</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold">3.</span>
            <span>Review and edit the generated questions</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold">4.</span>
            <span>Publish your quiz for students</span>
          </li>
        </ol>
        <p className="text-xs text-blue-700 mt-4">
          Supported: TXT, DOC, DOCX, PDF. For best results with complex PDFs, paste the text directly.
        </p>
      </div>
    </div>
  );
}
