import { useNetInfo } from '@react-native-community/netinfo';

/**
 * Simple reactive online/offline flag for gating network-dependent behavior
 * (e.g. skip an API call and show cached/downloaded content instead, or show
 * an "estás sin conexión" banner). `isInternetReachable` can briefly be null
 * while NetInfo is still probing — treat that as "assume online" so we don't
 * flash an offline state on every screen mount.
 */
export function useIsOnline(): boolean {
  const { isConnected, isInternetReachable } = useNetInfo();
  if (isConnected === false) return false;
  if (isInternetReachable === false) return false;
  return true;
}
