import { Wifi, WifiOff } from 'lucide-react';
import { FEATURE_LOW_BANDWIDTH_MODE } from '../lib/featureFlags';
import { useLowBandwidth } from '../hooks/useLowBandwidth';

export function LowBandwidthIndicator() {
  if (!FEATURE_LOW_BANDWIDTH_MODE) return null;

  const { isLowBandwidth, setUserOverride } = useLowBandwidth();

  const handleToggle = () => {
    const userOverrideStr = localStorage.getItem('ss_low_bw_user_override');

    if (userOverrideStr === null) {
      setUserOverride(!isLowBandwidth);
    } else {
      if (userOverrideStr === 'true') {
        setUserOverride(null);
      } else {
        setUserOverride(true);
      }
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-colors ${
        isLowBandwidth
          ? 'bg-amber-500 text-white hover:bg-amber-600'
          : 'bg-white text-gray-700 hover:bg-gray-100'
      }`}
      title={
        isLowBandwidth
          ? 'Lite mode enabled - Click to disable'
          : 'Lite mode disabled - Click to enable'
      }
    >
      {isLowBandwidth ? (
        <WifiOff className="w-4 h-4" />
      ) : (
        <Wifi className="w-4 h-4" />
      )}
      <span className="text-sm font-medium">
        {isLowBandwidth ? 'Lite' : 'Full'}
      </span>
    </button>
  );
}
