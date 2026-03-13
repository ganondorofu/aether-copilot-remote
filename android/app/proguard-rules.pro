# Add project specific ProGuard rules here.
-keep class com.copilot.remote.model.** { *; }
-keepclassmembers class com.copilot.remote.model.** { *; }
-keep class kotlinx.serialization.** { *; }
-keep class * extends androidx.activity.result.contract.ActivityResultContract { *; }
