import { useState, useEffect } from 'react';
import { Settings, Wifi, WifiOff } from 'lucide-react';
import { FEATURE_LOW_BANDWIDTH_MODE } from '../../lib/featureFlags';
import { useLowBandwidth } from '../../hooks/useLowBandwidth';

export function LowBandwidthSettings() {
  if (!FEATURE_LOW_BANDWIDTH_MODE) return null;

  const { setGlobalDefault } = useLowBandwidth();
  const [globalDefault, setGlobalDefaultState] = useState(false);

  useEffect(() => {
    const value = localStorage.getItem('ss_low_bw_global_default');
    setGlobalDefaultState(value === 'true');
  }, []);

  const handleToggle = () => {
    const newValue = !globalDefault;
    setGlobalDefaultState(newValue);
    setGlobalDefault(newValue);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-3 mb-4">
        <Settings className="w-6 h-6 text-gray-700" />
        <h2 className="text-xl font-semibold">Low Bandwidth Mode Settings</h2>
      </div>

      <div className="space-y-4">
        <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
          <h3 className="font-medium text-blue-900 mb-2">About Lite Mode</h3>
          <p className="text-sm text-blue-800">
            Lite mode optimizes the platform for slower connections by enabling
            lazy image loading, caching quiz data, and reducing animations.
          </p>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {globalDefault ? (
                <WifiOff className="w-5 h-5 text-amber-600" />
              ) : (
                <Wifi className="w-5 h-5 text-green-600" />
              )}
              <h3 className="font-medium text-gray-900">
                Global Default Setting
              </h3>
            </div>
            <p className="text-sm text-gray-600">
              {globalDefault
                ? 'Lite mode is enabled by default for all users'
                : 'Full mode is enabled by default for all users'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Users can override this setting from the indicator in the footer
            </p>
          </div>

          <button
            onClick={handleToggle}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              globalDefault ? 'bg-amber-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                globalDefault ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2 text-sm">
            localStorage Keys
          </h3>
          <div className="space-y-1 text-xs text-gray-600 font-mono">
            <div>
              <span className="font-semibold">ss_low_bw_global_default:</span>{' '}
              {String(globalDefault)}
            </div>
            <div>
              <span className="font-semibold">ss_low_bw_user_override:</span>{' '}
              {localStorage.getItem('ss_low_bw_user_override') || 'null'}
            </div>
          </div>
        </div>

        <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded">
          <h3 className="font-medium text-yellow-900 mb-2">
            No Database Writes
          </h3>
          <p className="text-sm text-yellow-800">
            All settings are stored in localStorage only. No server-side
            persistence.
          </p>
        </div>
      </div>
    </div>
  );
}
