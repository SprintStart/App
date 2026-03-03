import { useState, useEffect } from 'react';
import { Save, CircleAlert as AlertCircle, CircleCheck as CheckCircle } from 'lucide-react';

interface TokenSettings {
  enabled: boolean;
  expiryHours: number;
  dailyCapPerDevice: number;
}

export default function TokenSettingsPanel() {
  const [settings, setSettings] = useState<TokenSettings>({
    enabled: false,
    expiryHours: 24,
    dailyCapPerDevice: 3,
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const handleSave = () => {
    setSaveStatus('saving');

    try {
      localStorage.setItem('token_settings', JSON.stringify(settings));

      setTimeout(() => {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }, 500);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('token_settings');
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Token Rewards System</h2>
        <p className="text-sm text-gray-600">
          Configure the token rewards system for students. Tokens are issued after quiz completion and can be used to unlock special features.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <label className="text-sm font-semibold text-gray-900 block mb-1">
              Enable Token System
            </label>
            <p className="text-xs text-gray-600">
              Turn on to allow students to earn tokens after completing quizzes
            </p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-900 block mb-2">
            Token Expiry (Hours)
          </label>
          <input
            type="number"
            min="1"
            max="168"
            value={settings.expiryHours}
            onChange={(e) => setSettings({ ...settings, expiryHours: parseInt(e.target.value) || 24 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-600 mt-1">
            How long tokens remain valid (1-168 hours, default: 24)
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-900 block mb-2">
            Daily Cap Per Device
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={settings.dailyCapPerDevice}
            onChange={(e) => setSettings({ ...settings, dailyCapPerDevice: parseInt(e.target.value) || 3 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-600 mt-1">
            Maximum tokens a device can earn per day (1-20, default: 3)
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Available Rewards</h3>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Challenge Mode - Harder questions for advanced students</li>
            <li>• Bonus Quiz - 5 extra questions to practice</li>
            <li>• Premium Skin - Special theme for 24 hours</li>
            <li>• Power-Up - Boost for next quiz attempt</li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-900 mb-1">Important Notes</h3>
              <ul className="text-xs text-yellow-800 space-y-1">
                <li>• Changes take effect immediately for new tokens</li>
                <li>• Existing tokens retain their original expiry time</li>
                <li>• Tokens are validated server-side for security</li>
                <li>• No student accounts required (device-based)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveStatus === 'saving' ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Saving...</span>
            </>
          ) : saveStatus === 'success' ? (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>Saved Successfully</span>
            </>
          ) : saveStatus === 'error' ? (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>Save Failed</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
