package com.copilot.remote.ui

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.copilot.remote.model.*
import com.copilot.remote.ui.components.MarkdownText
import com.copilot.remote.viewmodel.CopilotViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CopilotScreen(
    vm: CopilotViewModel = viewModel(),
    preferencesRepository: com.copilot.remote.data.PreferencesRepository? = null,
    onThemeToggle: () -> Unit = {}
) {
    val connection by vm.connection.collectAsState()
    val authState by vm.authState.collectAsState()
    val chatItems by vm.chatItems.collectAsState()
    val modes by vm.modes.collectAsState()
    val currentMode by vm.currentMode.collectAsState()
    val models by vm.models.collectAsState()
    val currentModel by vm.currentModel.collectAsState()
    val commands by vm.commands.collectAsState()
    val configOptions by vm.configOptions.collectAsState()
    val permissions by vm.permissions.collectAsState()
    val running by vm.running.collectAsState()
    val serverUrl by vm.serverUrl.collectAsState()
    val yoloLevel by vm.yoloLevel.collectAsState()
    val usage by vm.usage.collectAsState()

    // Stored preferences — use bundled flow to avoid race conditions
    val savedCreds = preferencesRepository?.savedCredentials?.collectAsState(initial = null)
    val appLockEnabled = preferencesRepository?.appLockEnabled?.collectAsState(initial = false)

    // Track if preferences have loaded
    var prefsLoaded by remember { mutableStateOf(false) }
    var initialAuthDone by remember { mutableStateOf(false) }

    var promptText by remember { mutableStateOf("") }
    var showModelSheet by remember { mutableStateOf(false) }
    var showCommandSheet by remember { mutableStateOf(false) }
    var showSettingsSheet by remember { mutableStateOf(false) }
    var showYoloMenu by remember { mutableStateOf(false) }
    var showNewSessionDialog by remember { mutableStateOf(false) }
    var drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    // Check auth status ONCE when all preferences have loaded
    LaunchedEffect(savedCreds?.value) {
        if (initialAuthDone) return@LaunchedEffect // Already checked, don't loop
        val creds = savedCreds?.value ?: return@LaunchedEffect // DataStore not loaded yet
        prefsLoaded = true
        initialAuthDone = true
        val lockEnabled = appLockEnabled?.value ?: false
        if (creds.authToken != null && !lockEnabled) {
            // Have a saved token and lock is off — auto-authenticate
            vm.checkAuthStatus(creds.serverUrl, creds.authToken)
        } else {
            // No saved token OR app lock enabled — show login screen
            vm.checkAuthStatus(creds.serverUrl, null)
        }
    }

    // Smart auto-scroll: instant jump during replay, animated for live messages,
    // skip if user has scrolled up to read history
    val prevChatSize = remember { mutableIntStateOf(0) }
    LaunchedEffect(chatItems.size) {
        if (chatItems.isEmpty()) { prevChatSize.intValue = 0; return@LaunchedEffect }
        val sizeJump = chatItems.size - prevChatSize.intValue
        prevChatSize.intValue = chatItems.size
        // Check if user is near the bottom (within last 3 items)
        val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
        val nearBottom = lastVisible >= chatItems.size - 4 || sizeJump > 10
        if (nearBottom) {
            if (sizeJump > 10) {
                // Large batch (replay) — instant scroll, no animation
                listState.scrollToItem(chatItems.size - 1)
            } else {
                listState.animateScrollToItem(chatItems.size - 1)
            }
        }
    }

    // Persist workspaceId when it changes (only save non-null values)
    LaunchedEffect(connection.workspaceId) {
        if (connection.workspaceId != null) {
            preferencesRepository?.saveWorkspaceId(connection.workspaceId)
        }
    }

    // Derive stored values from the bundled credentials
    val storedUrl = savedCreds?.value?.serverUrl ?: "http://10.0.2.2:8787"
    val storedToken = savedCreds?.value?.authToken
    val storedWorkspaceId = savedCreds?.value?.workspaceId
    val storedUsername = savedCreds?.value?.username

    // Show auth screens if needed
    if (!prefsLoaded || authState.status == "checking") {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }
    when (authState.status) {
        "setup" -> {
            SetupScreen(
                serverUrl = storedUrl,
                error = authState.error,
                onSetup = { url, username, password ->
                    vm.setup(url, username, password) { token, uname ->
                        scope.launch {
                            preferencesRepository?.setRelayUrl(url)
                            preferencesRepository?.saveAuthToken(token)
                            preferencesRepository?.saveUsername(uname)
                            vm.connect(url, token, null, storedWorkspaceId)
                        }
                    }
                },
            )
            return
        }
        "login" -> {
            LoginScreen(
                serverUrl = storedUrl,
                storedUsername = storedUsername,
                error = authState.error,
                onLogin = { url, username, password ->
                    vm.login(url, username, password) { token, uname ->
                        scope.launch {
                            preferencesRepository?.setRelayUrl(url)
                            preferencesRepository?.saveAuthToken(token)
                            preferencesRepository?.saveUsername(uname)
                            vm.connect(url, token, null, storedWorkspaceId)
                        }
                    }
                },
                onCheckServer = { url ->
                    scope.launch { preferencesRepository?.setRelayUrl(url) }
                    vm.checkAuthStatus(url, null)
                },
            )
            return
        }
        "authenticated" -> {
            // Connect if not connected yet
            if (!connection.connected && connection.sessionId == null) {
                LaunchedEffect(Unit) {
                    vm.connect(storedUrl, storedToken, null, storedWorkspaceId)
                }
            }
        }
        "error" -> {
            LoginScreen(
                serverUrl = storedUrl,
                storedUsername = storedUsername,
                error = authState.error,
                onLogin = { url, username, password ->
                    vm.login(url, username, password) { token, uname ->
                        scope.launch {
                            preferencesRepository?.setRelayUrl(url)
                            preferencesRepository?.saveAuthToken(token)
                            preferencesRepository?.saveUsername(uname)
                            vm.connect(url, token, null, storedWorkspaceId)
                        }
                    }
                },
                onCheckServer = { url ->
                    scope.launch { preferencesRepository?.setRelayUrl(url) }
                    vm.checkAuthStatus(url, null)
                },
            )
            return
        }
    }

    // Wait for init message
    if (connection.sessionId == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator()
                Spacer(Modifier.height(16.dp))
                Text("Connecting...", style = MaterialTheme.typography.bodyMedium)
            }
        }
        return
    }

    // New session dialog with CWD input
    if (showNewSessionDialog) {
        NewSessionDialog(
            onDismiss = { showNewSessionDialog = false },
            onCreate = { cwd ->
                vm.createNewSession(cwd.ifBlank { null })
                showNewSessionDialog = false
                scope.launch { drawerState.close() }
            },
        )
    }

    // Permission dialog
    val activePerm = permissions.firstOrNull()
    if (activePerm != null) {
        PermissionDialog(
            permission = activePerm,
            onRespond = { optionId, feedback ->
                vm.respondPermission(activePerm.requestId, optionId, feedback)
            },
            onCancel = { vm.cancelPermission(activePerm.requestId) },
            queueSize = permissions.size,
        )
    }

    // Model bottom sheet
    if (showModelSheet) {
        ModalBottomSheet(onDismissRequest = { showModelSheet = false }) {
            Text("Select Model", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(16.dp))
            models.forEach { model ->
                ListItem(
                    headlineContent = { Text(model.name ?: model.modelId) },
                    supportingContent = model.description?.let { { Text(it, maxLines = 1) } },
                    leadingContent = {
                        if (model.modelId == currentModel) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        }
                    },
                    modifier = Modifier.clickable {
                        vm.setModel(model.modelId)
                        showModelSheet = false
                    },
                )
            }
            Spacer(Modifier.height(32.dp))
        }
    }

    // Command bottom sheet
    if (showCommandSheet) {
        ModalBottomSheet(onDismissRequest = { showCommandSheet = false }) {
            Text("Slash Commands", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(16.dp))
            commands.forEach { cmd ->
                ListItem(
                    headlineContent = { Text("/${cmd.name}", color = MaterialTheme.colorScheme.primary) },
                    supportingContent = { Text(cmd.description, maxLines = 2) },
                    modifier = Modifier.clickable {
                        promptText = "/${cmd.name} "
                        showCommandSheet = false
                    },
                )
            }
            Spacer(Modifier.height(32.dp))
        }
    }

    // Settings bottom sheet
    if (showSettingsSheet) {
        ModalBottomSheet(onDismissRequest = { showSettingsSheet = false }) {
            Text("Settings", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(16.dp))
            
            // App Lock toggle
            ListItem(
                headlineContent = { Text("App Lock") },
                supportingContent = { Text("Require login each time app starts", fontSize = 12.sp) },
                trailingContent = {
                    Switch(
                        checked = appLockEnabled?.value ?: false,
                        onCheckedChange = { enabled ->
                            scope.launch { preferencesRepository?.setAppLockEnabled(enabled) }
                        }
                    )
                }
            )
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

            if (configOptions.isEmpty()) {
                Text(
                    "No configuration options available",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(16.dp)
                )
            } else {
                configOptions.forEach { opt ->
                    when (opt.type) {
                        "boolean" -> {
                            val isChecked = when (val v = opt.value) {
                                is kotlinx.serialization.json.JsonPrimitive -> if (v.isString) false else v.content.toBooleanStrictOrNull() ?: false
                                else -> false
                            }
                            ListItem(
                                headlineContent = { Text(opt.name ?: opt.configId) },
                                supportingContent = opt.description?.let { { Text(it, fontSize = 12.sp, maxLines = 2) } },
                                trailingContent = {
                                    Switch(
                                        checked = isChecked,
                                        onCheckedChange = { checked ->
                                            vm.setConfigOption(opt.configId, checked)
                                        }
                                    )
                                }
                            )
                        }
                        else -> {
                            // Check if has options for dropdown
                            val optionsList = when (val opts = opt.options) {
                                is kotlinx.serialization.json.JsonArray -> {
                                    opts.mapNotNull { elem ->
                                        when (elem) {
                                            is kotlinx.serialization.json.JsonPrimitive -> elem.content
                                            is kotlinx.serialization.json.JsonObject -> {
                                                elem["name"]?.let { (it as? kotlinx.serialization.json.JsonPrimitive)?.content }
                                                    ?: elem["value"]?.let { (it as? kotlinx.serialization.json.JsonPrimitive)?.content }
                                            }
                                            else -> null
                                        }
                                    }
                                }
                                else -> emptyList()
                            }
                            
                            if (optionsList.isNotEmpty()) {
                                var expanded by remember { mutableStateOf(false) }
                                val currentValue = when (val v = opt.value) {
                                    is kotlinx.serialization.json.JsonPrimitive -> v.content
                                    else -> opt.currentValue ?: ""
                                }
                                
                                ListItem(
                                    headlineContent = { Text(opt.name ?: opt.configId) },
                                    supportingContent = {
                                        Column {
                                            opt.description?.let { Text(it, fontSize = 12.sp, maxLines = 2) }
                                            Box {
                                                OutlinedButton(
                                                    onClick = { expanded = true },
                                                    modifier = Modifier.padding(top = 4.dp)
                                                ) {
                                                    Text(currentValue, fontSize = 12.sp)
                                                    Icon(
                                                        Icons.Default.ArrowDropDown,
                                                        contentDescription = null,
                                                        modifier = Modifier.size(16.dp)
                                                    )
                                                }
                                                DropdownMenu(
                                                    expanded = expanded,
                                                    onDismissRequest = { expanded = false }
                                                ) {
                                                    optionsList.forEach { option ->
                                                        DropdownMenuItem(
                                                            text = { Text(option, fontSize = 13.sp) },
                                                            onClick = {
                                                                vm.setConfigOption(opt.configId, option)
                                                                expanded = false
                                                            }
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    }
                                )
                            } else {
                                // Display-only config option
                                ListItem(
                                    headlineContent = { Text(opt.name ?: opt.configId) },
                                    supportingContent = {
                                        val displayValue = when (val v = opt.value) {
                                            is kotlinx.serialization.json.JsonPrimitive -> v.content
                                            else -> opt.currentValue ?: ""
                                        }
                                        Text(displayValue, fontSize = 12.sp)
                                    }
                                )
                            }
                        }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
            
            // Logout button
            TextButton(
                onClick = {
                    showSettingsSheet = false
                    scope.launch {
                        val url = storedUrl
                        val token = storedToken ?: ""
                        preferencesRepository?.saveAuthToken(null)
                        preferencesRepository?.saveWorkspaceId(null)
                        preferencesRepository?.saveUsername(null)
                        vm.logout(url, token)
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
            ) {
                Icon(Icons.Default.ExitToApp, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Sign Out")
            }
            Spacer(Modifier.height(32.dp))
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            NavigationDrawerContent(
                sessions = connection.sessions,
                currentSessionId = connection.sessionId,
                onSessionClick = { sessionId ->
                    vm.switchSession(sessionId)
                    scope.launch { drawerState.close() }
                },
                onNewSession = {
                    showNewSessionDialog = true
                },
                onDeleteSession = { sessionId ->
                    vm.deleteSession(sessionId)
                },
                connected = connection.connected,
            )
        },
    ) {
        Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("△", fontSize = 20.sp, color = MaterialTheme.colorScheme.primary)
                            Text("Aether", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                            // Status badge
                            Surface(
                                shape = CircleShape,
                                color = if (connection.connected) Color(0xFF3FB950) else Color(0xFF6E7681),
                                modifier = Modifier.size(8.dp),
                            ) {}
                        }
                        // CWD display (if available)
                        connection.sessions.find { it.sessionId == connection.sessionId }?.let { session ->
                            // Display basic session info as CWD placeholder
                            Text(
                                text = "Session: ${session.sessionId.take(8)}",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { scope.launch { drawerState.open() } }) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu")
                    }
                },
                actions = {
                    // YOLO level selector
                    Box {
                        Surface(
                            onClick = { showYoloMenu = true },
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)),
                            modifier = Modifier.padding(horizontal = 4.dp),
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            ) {
                                Text(
                                    text = when (yoloLevel) {
                                        0 -> "Normal"
                                        1 -> "Trust reads"
                                        2 -> "Trust most"
                                        3 -> "YOLO"
                                        else -> "Normal"
                                    },
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Icon(
                                    Icons.Default.ArrowDropDown,
                                    contentDescription = "Select YOLO Level",
                                    modifier = Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        DropdownMenu(
                            expanded = showYoloMenu,
                            onDismissRequest = { showYoloMenu = false },
                        ) {
                            listOf(
                                0 to "Normal",
                                1 to "Trust reads",
                                2 to "Trust most",
                                3 to "YOLO",
                            ).forEach { (level, label) ->
                                DropdownMenuItem(
                                    text = { 
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        ) {
                                            if (level == yoloLevel) {
                                                Icon(
                                                    Icons.Default.Check,
                                                    contentDescription = null,
                                                    tint = MaterialTheme.colorScheme.primary,
                                                    modifier = Modifier.size(18.dp),
                                                )
                                            } else {
                                                Spacer(Modifier.size(18.dp))
                                            }
                                            Text(label, fontSize = 13.sp)
                                        }
                                    },
                                    onClick = {
                                        vm.setYoloLevel(level)
                                        showYoloMenu = false
                                    },
                                )
                            }
                        }
                    }
                    // Model button
                    if (models.isNotEmpty()) {
                        TextButton(onClick = { showModelSheet = true }) {
                            Text(
                                models.find { it.modelId == currentModel }?.name?.take(12) ?: currentModel.take(12),
                                fontSize = 11.sp,
                                maxLines = 1,
                            )
                        }
                    }
                    // Theme toggle button
                    IconButton(onClick = onThemeToggle) {
                        Icon(
                            Icons.Default.LightMode, // Moon for dark theme, Sun for light
                            contentDescription = "Toggle Theme"
                        )
                    }
                    // Settings button
                    IconButton(onClick = { showSettingsSheet = true }) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                    // Attach file button (TODO: implement file picker)
                    IconButton(onClick = { 
                        // TODO: Implement file attachment with Activity Result API
                    }) {
                        Icon(Icons.Default.AttachFile, contentDescription = "Attach File")
                    }
                    // Reconnect
                    if (!connection.connected) {
                        IconButton(onClick = { 
                            // Reconnect not implemented in this version
                        }) {
                            Icon(Icons.Default.Refresh, contentDescription = "Reconnect")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
            )
        },
        bottomBar = {
            Column(modifier = Modifier.background(MaterialTheme.colorScheme.surface)) {
                // Mode tabs
                if (modes.isNotEmpty()) {
                    ScrollableTabRow(
                        selectedTabIndex = modes.indexOfFirst { it.id == currentMode }.coerceAtLeast(0),
                        containerColor = MaterialTheme.colorScheme.surface,
                        edgePadding = 8.dp,
                        divider = {},
                    ) {
                        modes.forEach { mode ->
                            Tab(
                                selected = mode.id == currentMode,
                                onClick = { vm.setMode(mode.id) },
                                text = { Text(mode.name.ifEmpty { mode.id }, fontSize = 12.sp) },
                            )
                        }
                    }
                }

                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))

                // Input row
                Row(
                    modifier = Modifier
                        .padding(horizontal = 8.dp, vertical = 6.dp)
                        .navigationBarsPadding()
                        .imePadding(),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    // Slash command button
                    if (commands.isNotEmpty()) {
                        IconButton(
                            onClick = { showCommandSheet = true },
                            modifier = Modifier.size(40.dp),
                        ) {
                            Text("/", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                        }
                    }

                    // Text input
                    OutlinedTextField(
                        value = promptText,
                        onValueChange = { promptText = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("メッセージを入力…", fontSize = 14.sp) },
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(onSend = {
                            if (promptText.isNotBlank() && !running) {
                                vm.sendPrompt(promptText)
                                promptText = ""
                            }
                        }),
                        maxLines = 4,
                        shape = RoundedCornerShape(20.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                        ),
                    )

                    // Send / Cancel button
                    if (running) {
                        FilledIconButton(
                            onClick = { vm.cancel() },
                            modifier = Modifier.size(42.dp),
                            colors = IconButtonDefaults.filledIconButtonColors(
                                containerColor = MaterialTheme.colorScheme.error,
                            ),
                        ) {
                            Icon(Icons.Default.Stop, contentDescription = "Cancel")
                        }
                    } else {
                        FilledIconButton(
                            onClick = {
                                if (promptText.isNotBlank()) {
                                    vm.sendPrompt(promptText)
                                    promptText = ""
                                }
                            },
                            modifier = Modifier.size(42.dp),
                            enabled = promptText.isNotBlank() && connection.connected,
                        ) {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                        }
                    }
                }

                // Usage display
                usage?.let { u ->
                    val parts = mutableListOf<String>()
                    u.contextSize?.let { parts.add("ctx: ${(it / 1000)}k") }
                    u.totalCost?.let { parts.add("cost: $it") }
                    u.inputTokens?.let { parts.add("in: $it") }
                    u.outputTokens?.let { parts.add("out: $it") }
                    
                    if (parts.isNotEmpty()) {
                        Text(
                            text = parts.joinToString(" | "),
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        )
                    }
                }
            }
        },
    ) { padding ->
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            contentPadding = PaddingValues(vertical = 8.dp),
        ) {
            items(chatItems, key = { item ->
                when (item) {
                    is ChatItem.UserMessage -> item.id
                    is ChatItem.AgentMessage -> item.id
                    is ChatItem.ThoughtMessage -> item.id
                    is ChatItem.ToolCall -> item.toolCallId
                    is ChatItem.PlanView -> item.id
                    is ChatItem.Status -> item.id
                    is ChatItem.Error -> item.id
                    is ChatItem.Done -> item.id
                }
            }) { item ->
                when (item) {
                    is ChatItem.UserMessage -> UserBubble(item.text)
                    is ChatItem.AgentMessage -> AgentBubble(item.text)
                    is ChatItem.ThoughtMessage -> ThoughtBubble(item.text)
                    is ChatItem.ToolCall -> ToolCallCard(item)
                    is ChatItem.PlanView -> PlanCard(item.entries)
                    is ChatItem.Status -> StatusChip(item.text)
                    is ChatItem.Error -> ErrorChip(item.text)
                    is ChatItem.Done -> DoneChip(item.stopReason)
                }
            }
        }
    }
    }
}

// ── Navigation Drawer ──

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NavigationDrawerContent(
    sessions: List<com.copilot.remote.network.CopilotWebSocket.SessionInfo>,
    currentSessionId: String?,
    onSessionClick: (String) -> Unit,
    onNewSession: () -> Unit,
    onDeleteSession: (String) -> Unit,
    connected: Boolean,
) {
    ModalDrawerSheet(
        modifier = Modifier.width(320.dp),
        drawerContainerColor = MaterialTheme.colorScheme.surface,
    ) {
        // Header
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Surface(
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                    modifier = Modifier.size(40.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("△", fontSize = 20.sp, color = MaterialTheme.colorScheme.primary)
                    }
                }
                Column {
                    Text(
                        "Aether",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = if (connected) Color(0xFF3FB950) else Color(0xFF6E7681),
                            modifier = Modifier.size(6.dp),
                        ) {}
                        Text(
                            if (connected) "Connected" else "Disconnected",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        HorizontalDivider()

        // New Session button
        TextButton(
            onClick = onNewSession,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
        ) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("New Session")
        }

        HorizontalDivider()

        // Session list
        if (sessions.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "No sessions yet",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(vertical = 4.dp),
            ) {
                items(sessions.size) { index ->
                    SessionListItem(
                        session = sessions[index],
                        isActive = sessions[index].sessionId == currentSessionId,
                        onClick = { onSessionClick(sessions[index].sessionId) },
                        onDelete = { onDeleteSession(sessions[index].sessionId) },
                        canDelete = sessions.size > 1,
                    )
                }
            }
        }
    }
}

@Composable
fun SessionListItem(
    session: com.copilot.remote.network.CopilotWebSocket.SessionInfo,
    isActive: Boolean,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    canDelete: Boolean,
) {
    val containerColor = if (isActive) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        Color.Transparent
    }
    
    Surface(
        onClick = onClick,
        color = containerColor,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 2.dp),
        shape = RoundedCornerShape(8.dp),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Icon
            Surface(
                shape = CircleShape,
                color = if (isActive) {
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                } else {
                    MaterialTheme.colorScheme.surfaceVariant
                },
                modifier = Modifier.size(32.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Default.ChatBubble,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = if (isActive) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
            }

            // Content
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    session.title.ifBlank { session.sessionId.take(8) + "…" },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                    fontFamily = FontFamily.Monospace,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    session.cwd,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            // Status and delete
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Surface(
                    shape = CircleShape,
                    color = if (!session.busy) Color(0xFF3FB950) else Color(0xFF6E7681),
                    modifier = Modifier.size(6.dp),
                ) {}
                
                if (canDelete) {
                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier.size(24.dp),
                    ) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Delete",
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

// ── Chat item composables ──

@Composable
fun UserBubble(text: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        Surface(
            shape = RoundedCornerShape(16.dp, 16.dp, 4.dp, 16.dp),
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.widthIn(max = 300.dp),
        ) {
            Text(text, modifier = Modifier.padding(12.dp), color = Color.White, fontSize = 14.sp)
        }
    }
}

@Composable
fun AgentBubble(text: String) {
    Surface(
        shape = RoundedCornerShape(4.dp, 16.dp, 16.dp, 16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth(),
    ) {
        MarkdownText(
            markdown = text,
            modifier = Modifier.padding(12.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium.copy(
                fontSize = 14.sp,
                lineHeight = 20.sp,
            ),
        )
    }
}

@Composable
fun ThoughtBubble(text: String) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        TextButton(
            onClick = { expanded = !expanded },
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
        ) {
            Text(
                "💭 ${if (expanded) "Thinking ▾" else "Thinking… (tap to expand)"}",
                fontSize = 12.sp,
                color = Color(0xFFBC8CFF),
            )
        }
        AnimatedVisibility(visible = expanded) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 8.dp),
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, Color(0xFFBC8CFF).copy(alpha = 0.3f)),
            ) {
                Text(
                    text = text,
                    modifier = Modifier.padding(8.dp),
                    fontSize = 12.sp,
                    fontStyle = FontStyle.Italic,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
fun ToolCallCard(tool: ChatItem.ToolCall) {
    var expanded by remember { mutableStateOf(false) }
    val iconMap = mapOf(
        "read" to "📖", "edit" to "✏️", "delete" to "🗑️", "move" to "📁",
        "search" to "🔍", "execute" to "⚡", "think" to "🧠", "fetch" to "🌐",
    )
    val statusColor = when (tool.status) {
        "completed" -> Color(0xFF3FB950)
        "in_progress" -> Color(0xFF58A6FF)
        "failed" -> Color(0xFFF85149)
        else -> Color(0xFF8B949E)
    }

    OutlinedCard(
        modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded },
        shape = RoundedCornerShape(8.dp),
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(iconMap[tool.kind] ?: "🔧", fontSize = 14.sp)
                Text(tool.title, fontSize = 12.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = statusColor.copy(alpha = 0.15f),
                ) {
                    Text(
                        tool.status.uppercase(),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = statusColor,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
                Icon(
                    if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (expanded) "Collapse" else "Expand",
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            AnimatedVisibility(visible = expanded) {
                Column(modifier = Modifier.padding(top = 6.dp)) {
                    if (tool.contentText.isNotBlank()) {
                        Text(
                            tool.contentText,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 20,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (tool.locations.isNotEmpty()) {
                        Row(
                            modifier = Modifier.padding(top = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            tool.locations.take(3).forEach { loc ->
                                Surface(
                                    shape = RoundedCornerShape(3.dp),
                                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                                ) {
                                    Text(
                                        "${loc.path.substringAfterLast("/")}${loc.line?.let { ":$it" } ?: ""}",
                                        fontSize = 10.sp,
                                        color = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PlanCard(entries: List<PlanEntry>) {
    OutlinedCard(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text("📋 Plan", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            entries.forEach { entry ->
                val icon = when (entry.status) {
                    "completed" -> "✅"
                    "in_progress" -> "🔄"
                    else -> "⬜"
                }
                val color = when (entry.status) {
                    "completed" -> Color(0xFF3FB950)
                    "in_progress" -> Color(0xFF58A6FF)
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }
                Row(
                    modifier = Modifier.padding(vertical = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(icon, fontSize = 12.sp)
                    Text(entry.content, fontSize = 12.sp, color = color)
                    if (entry.priority == "high") {
                        Text("●", fontSize = 8.sp, color = Color(0xFFF85149))
                    }
                }
            }
        }
    }
}

@Composable
fun StatusChip(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 1.dp),
    )
}

@Composable
fun ErrorChip(text: String) {
    Surface(
        shape = RoundedCornerShape(6.dp),
        color = MaterialTheme.colorScheme.error.copy(alpha = 0.1f),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(text, modifier = Modifier.padding(8.dp), fontSize = 12.sp, color = MaterialTheme.colorScheme.error)
    }
}

@Composable
fun DoneChip(reason: String) {
    HorizontalDivider(
        modifier = Modifier.padding(vertical = 4.dp),
        color = Color(0xFF3FB950).copy(alpha = 0.3f),
    )
    Text(
        "✓ $reason",
        fontSize = 11.sp,
        color = Color(0xFF3FB950),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 4.dp),
    )
}

// ── Permission Dialog ──

@Composable
fun PermissionDialog(
    permission: ActivePermission,
    onRespond: (String, String?) -> Unit,
    onCancel: () -> Unit,
    queueSize: Int,
) {
    var feedbackText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text(permission.title, fontSize = 14.sp) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Tool call details
                permission.toolCall?.rawInput?.let { raw ->
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                    ) {
                        Text(
                            raw.toString(),
                            modifier = Modifier
                                .padding(8.dp)
                                .horizontalScroll(rememberScrollState()),
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 10,
                        )
                    }
                }

                if (queueSize > 1) {
                    Text("$queueSize pending requests", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }

                // Option buttons
                permission.options.forEach { opt ->
                    val isAllow = opt.kind?.contains("allow") == true
                    val isReject = opt.kind?.contains("reject") == true
                    OutlinedButton(
                        onClick = { onRespond(opt.optionId, null) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = when {
                                isAllow -> Color(0xFF3FB950)
                                isReject -> Color(0xFFF85149)
                                else -> MaterialTheme.colorScheme.primary
                            },
                        ),
                    ) {
                        Text(opt.name ?: opt.optionId, fontSize = 13.sp)
                    }
                }

                HorizontalDivider()

                // Feedback reject
                OutlinedTextField(
                    value = feedbackText,
                    onValueChange = { feedbackText = it },
                    label = { Text("Reject with feedback…") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = {
                        val rejectOpt = permission.options.find { it.kind?.contains("reject") == true }
                            ?: permission.options.lastOrNull()
                        rejectOpt?.let { onRespond(it.optionId, feedbackText) }
                    }),
                )
                Button(
                    onClick = {
                        val rejectOpt = permission.options.find { it.kind?.contains("reject") == true }
                            ?: permission.options.lastOrNull()
                        rejectOpt?.let { onRespond(it.optionId, feedbackText) }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Reject with feedback")
                }
            }
        },
        confirmButton = {},
    )
}

@Composable
fun SetupScreen(
    serverUrl: String,
    error: String?,
    onSetup: (String, String, String) -> Unit,
) {
    var url by remember { mutableStateOf(serverUrl) }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("△", fontSize = 48.sp)
        Spacer(Modifier.height(8.dp))
        Text(
            "Aether",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "Create your account to get started",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))
        
        OutlinedTextField(
            value = url,
            onValueChange = { url = it },
            label = { Text("Server URL") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("Username") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password (min 6 chars)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            visualTransformation = PasswordVisualTransformation(),
        )
        
        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }
        
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { onSetup(url, username.trim(), password) },
            modifier = Modifier.fillMaxWidth(),
            enabled = url.isNotBlank() && username.isNotBlank() && password.length >= 6,
        ) {
            Text("Create Account")
        }
    }
}

@Composable
fun LoginScreen(
    serverUrl: String,
    storedUsername: String? = null,
    error: String?,
    onLogin: (url: String, username: String, password: String) -> Unit,
    onCheckServer: ((String) -> Unit)? = null,
) {
    var url by remember { mutableStateOf(serverUrl) }
    var username by remember { mutableStateOf(storedUsername ?: "") }
    var password by remember { mutableStateOf("") }
    var testResult by remember { mutableStateOf<String?>(null) }
    var testing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // Update fields when stored values arrive (DataStore loads after initial compose)
    LaunchedEffect(serverUrl) {
        if (serverUrl.isNotBlank()) url = serverUrl
    }
    LaunchedEffect(storedUsername) {
        if (!storedUsername.isNullOrBlank() && username.isBlank()) username = storedUsername
    }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("△", fontSize = 48.sp)
        Spacer(Modifier.height(8.dp))
        Text(
            "Aether",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "Sign in to continue",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))
        
        OutlinedTextField(
            value = url,
            onValueChange = { url = it; testResult = null },
            label = { Text("Server URL") },
            placeholder = { Text("http://192.168.x.x:8787") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        
        Spacer(Modifier.height(8.dp))
        OutlinedButton(
            onClick = {
                testing = true
                testResult = null
                scope.launch {
                    try {
                        val request = okhttp3.Request.Builder()
                            .url("${url.trimEnd('/')}/api/auth/status")
                            .get().build()
                        val response = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                            okhttp3.OkHttpClient.Builder()
                                .connectTimeout(5, java.util.concurrent.TimeUnit.SECONDS)
                                .build()
                                .newCall(request).execute()
                        }
                        response.use {
                            if (it.isSuccessful) {
                                val body = it.body?.string() ?: "{}"
                                if (body.contains("setup")) {
                                    testResult = "✓ Server reachable (setup required)"
                                    onCheckServer?.invoke(url)
                                } else {
                                    testResult = "✓ Server reachable"
                                }
                            } else {
                                testResult = "✗ Server returned ${it.code}"
                            }
                        }
                    } catch (e: Exception) {
                        testResult = "✗ ${e.message}"
                    } finally {
                        testing = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = url.isNotBlank() && !testing,
        ) {
            if (testing) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(8.dp))
            }
            Text("Test Connection")
        }
        
        if (testResult != null) {
            Spacer(Modifier.height(4.dp))
            Text(
                testResult!!,
                fontSize = 13.sp,
                color = if (testResult!!.startsWith("✓")) Color(0xFF3FB950) else MaterialTheme.colorScheme.error,
            )
        }
        
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("Username") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            visualTransformation = PasswordVisualTransformation(),
        )
        
        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }
        
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = { onLogin(url, username.trim(), password) },
            modifier = Modifier.fillMaxWidth(),
            enabled = url.isNotBlank() && username.isNotBlank() && password.isNotBlank(),
        ) {
            Text("Sign In")
        }
    }
}

@Composable
fun NewSessionDialog(
    onDismiss: () -> Unit,
    onCreate: (cwd: String) -> Unit,
) {
    var cwd by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Session") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Specify a working directory for this session.",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = cwd,
                    onValueChange = { cwd = it },
                    label = { Text("Working Directory") },
                    placeholder = { Text("/home/user/project") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            Button(onClick = { onCreate(cwd.trim()) }) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        },
    )
}
