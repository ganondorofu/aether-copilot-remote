package com.copilot.remote.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF58A6FF),
    secondary = Color(0xFF388BFD),
    tertiary = Color(0xFFBC8CFF),
    background = Color(0xFF0D1117),
    surface = Color(0xFF161B22),
    surfaceVariant = Color(0xFF1C2128),
    onBackground = Color(0xFFE6EDF3),
    onSurface = Color(0xFFE6EDF3),
    onSurfaceVariant = Color(0xFF8B949E),
    error = Color(0xFFF85149),
    outline = Color(0xFF30363D),
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF0969DA),
    secondary = Color(0xFF0550AE),
    tertiary = Color(0xFF8250DF),
    background = Color(0xFFFFFFFF),
    surface = Color(0xFFF6F8FA),
    surfaceVariant = Color(0xFFEAEEF2),
    onBackground = Color(0xFF1F2328),
    onSurface = Color(0xFF1F2328),
    onSurfaceVariant = Color(0xFF656D76),
    error = Color(0xFFCF222E),
    outline = Color(0xFFD0D7DE),
)

@Composable
fun CopilotRemoteTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        darkTheme && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            dynamicDarkColorScheme(LocalContext.current).copy(
                background = Color(0xFF0D1117),
                surface = Color(0xFF161B22),
            )
        }
        !darkTheme && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            dynamicLightColorScheme(LocalContext.current)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content,
    )
}
