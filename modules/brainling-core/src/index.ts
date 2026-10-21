import { NativeModule, requireNativeModule } from 'expo';

type BrainlingCoreEvents = Record<string, never>;

declare class BrainlingCoreModule extends NativeModule<BrainlingCoreEvents> {}

/** Native Kotlin core (Android only). The API surface is defined in M1 (detection) and M4 (lock). */
export default requireNativeModule<BrainlingCoreModule>('BrainlingCore');
