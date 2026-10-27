# thumbwell-core

Local Expo Module (Android, Kotlin) that will hold everything that must run natively:

| Area                                                                          | Module | Planned package                                              |
| ----------------------------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| AccessibilityService reel detection, signed rulesets, Room storage, JS bridge | M1     | `com.algoastics.thumbwell.core.detection` / `.rules` / `.db` |
| `TYPE_ACCESSIBILITY_OVERLAY` lock view, schedules, strict mode                | M4     | `com.algoastics.thumbwell.core.lock`                         |
| Local notifications                                                           | M9     | `com.algoastics.thumbwell.core.notifications`                |
| Config plugin (service declaration, accessibility XML)                        | M1     | `plugin/`                                                    |

The module is autolinked from `modules/` and currently registers the `ThumbwellCore` native module
with no functions. Each feature module adds its API together with its tests
(`./gradlew :thumbwell-core:assembleDebug lint` must pass for native changes).
