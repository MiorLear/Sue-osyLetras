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

/**
 * True when the connection is likely to cost the teacher money per megabyte
 * (cellular, or a Wi-Fi hotspot the OS reports as expensive). Used to hold back
 * proactive syncing — see SCALE-03. Undetectable cases report false, so this
 * only ever *reduces* traffic, never blocks a connection we can't classify.
 */
export function useIsMetered(): boolean {
  const { type, details } = useNetInfo();
  if (details && 'isConnectionExpensive' in details && details.isConnectionExpensive) return true;
  return type === 'cellular';
}
