# Strip verbose and debug logging from release builds (docs/SECURITY.md §11).
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
}

# BouncyCastle (Ed25519 ruleset verification): only the lightweight API is used; its optional
# JCA/JNDI integrations reference classes Android does not ship.
-dontwarn javax.naming.**
-dontwarn org.bouncycastle.jsse.**
