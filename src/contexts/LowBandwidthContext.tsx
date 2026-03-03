import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { FEATURE_LOW_BANDWIDTH_MODE } from '../lib/featureFlags';

interface LowBandwidthContextValue {
  isLowBandwidth: boolean;
  setUserOverride: (value: boolean | null) => void;
  setGlobalDefault: (value: boolean) => void;
}

const LowBandwidthContext = createContext<LowBandwidthContextValue | undefined>(
  undefined
);

export function LowBandwidthProvider({ children }: { children: ReactNode }) {
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);

  useEffect(() => {
    if (!FEATURE_LOW_BANDWIDTH_MODE) {
      setIsLowBandwidth(false);
      return;
    }

    const updateMode = () => {
      const userOverrideStr = localStorage.getItem('ss_low_bw_user_override');
      const globalDefaultStr = localStorage.getItem('ss_low_bw_global_default');

      let effectiveMode = false;

      if (userOverrideStr !== null) {
        effectiveMode = userOverrideStr === 'true';
      } else if (globalDefaultStr !== null) {
        effectiveMode = globalDefaultStr === 'true';
      }

      setIsLowBandwidth(effectiveMode);

      if (effectiveMode) {
        document.body.classList.add('low-bandwidth-mode');
      } else {
        document.body.classList.remove('low-bandwidth-mode');
      }
    };

    updateMode();

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'ss_low_bw_user_override' ||
        e.key === 'ss_low_bw_global_default'
      ) {
        updateMode();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const setUserOverride = (value: boolean | null) => {
    if (!FEATURE_LOW_BANDWIDTH_MODE) return;

    if (value === null) {
      localStorage.removeItem('ss_low_bw_user_override');
    } else {
      localStorage.setItem('ss_low_bw_user_override', String(value));
    }

    const globalDefaultStr = localStorage.getItem('ss_low_bw_global_default');
    const effectiveMode =
      value !== null ? value : globalDefaultStr === 'true' || false;

    setIsLowBandwidth(effectiveMode);

    if (effectiveMode) {
      document.body.classList.add('low-bandwidth-mode');
    } else {
      document.body.classList.remove('low-bandwidth-mode');
    }
  };

  const setGlobalDefault = (value: boolean) => {
    if (!FEATURE_LOW_BANDWIDTH_MODE) return;

    localStorage.setItem('ss_low_bw_global_default', String(value));

    const userOverrideStr = localStorage.getItem('ss_low_bw_user_override');
    if (userOverrideStr === null) {
      setIsLowBandwidth(value);

      if (value) {
        document.body.classList.add('low-bandwidth-mode');
      } else {
        document.body.classList.remove('low-bandwidth-mode');
      }
    }
  };

  return (
    <LowBandwidthContext.Provider
      value={{ isLowBandwidth, setUserOverride, setGlobalDefault }}
    >
      {children}
    </LowBandwidthContext.Provider>
  );
}

export function useLowBandwidthContext() {
  const context = useContext(LowBandwidthContext);
  if (!context) {
    throw new Error(
      'useLowBandwidthContext must be used within LowBandwidthProvider'
    );
  }
  return context;
}
