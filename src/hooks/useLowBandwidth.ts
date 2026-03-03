import { useLowBandwidthContext } from '../contexts/LowBandwidthContext';

export function useLowBandwidth() {
  return useLowBandwidthContext();
}
