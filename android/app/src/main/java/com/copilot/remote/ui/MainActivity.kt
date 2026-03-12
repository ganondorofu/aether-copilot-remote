package com.copilot.remote.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.copilot.remote.data.PreferencesRepository
import com.copilot.remote.ui.theme.CopilotRemoteTheme
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val context = LocalContext.current
            val prefsRepo = remember { PreferencesRepository(context) }
            val theme by prefsRepo.theme.collectAsState(initial = "dark")
            val appLockEnabled by prefsRepo.appLockEnabled.collectAsState(initial = false)
            val scope = rememberCoroutineScope()
            var unlocked by remember { mutableStateOf(false) }

            // Show biometric prompt if app lock is enabled
            LaunchedEffect(appLockEnabled) {
                if (!appLockEnabled) {
                    unlocked = true
                }
            }

            CopilotRemoteTheme(darkTheme = theme == "dark") {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    if (appLockEnabled && !unlocked) {
                        LockScreen(
                            onAuthenticate = {
                                val activity = context as FragmentActivity
                                val executor = ContextCompat.getMainExecutor(activity)
                                val prompt = BiometricPrompt(activity, executor,
                                    object : BiometricPrompt.AuthenticationCallback() {
                                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                                            unlocked = true
                                        }
                                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                                            if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                                                errorCode == BiometricPrompt.ERROR_USER_CANCELED) {
                                                // User cancelled
                                            }
                                        }
                                    })
                                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                                    .setTitle("Aether")
                                    .setSubtitle("Authenticate to continue")
                                    .setAllowedAuthenticators(
                                        BiometricManager.Authenticators.BIOMETRIC_WEAK or
                                        BiometricManager.Authenticators.DEVICE_CREDENTIAL
                                    )
                                    .build()
                                prompt.authenticate(promptInfo)
                            }
                        )
                    } else {
                        CopilotScreen(
                            preferencesRepository = prefsRepo,
                            onThemeToggle = {
                                scope.launch {
                                    val newTheme = if (theme == "dark") "light" else "dark"
                                    prefsRepo.setTheme(newTheme)
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LockScreen(onAuthenticate: () -> Unit) {
    LaunchedEffect(Unit) { onAuthenticate() }
    
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            Icons.Default.Lock,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(16.dp))
        Text("Aether", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text("Tap to unlock", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(24.dp))
        Button(onClick = onAuthenticate) {
            Text("Unlock")
        }
    }
}
