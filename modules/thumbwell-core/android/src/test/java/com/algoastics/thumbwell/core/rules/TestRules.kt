package com.algoastics.thumbwell.core.rules

/** The rule for [packageName] even when the app is switched off in the ruleset (Phase 0 flags). */
fun RuleSet.anyRuleFor(packageName: String): AppRule = apps.first { packageName in it.packageNames }
