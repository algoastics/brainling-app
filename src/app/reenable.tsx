import { Redirect } from 'expo-router';

/**
 * Target of the watchdog's "service turned off" notification (`thumbwell://reenable`). The
 * Accessibility disclosure (S06) always comes first; from there the guide opens the settings.
 */
export default function ReenableRoute() {
  return <Redirect href={{ pathname: '/disclosure', params: { from: 'reenable' } }} />;
}
