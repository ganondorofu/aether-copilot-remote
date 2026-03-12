package com.copilot.remote.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.copilot.remote.model.*
import com.copilot.remote.network.CopilotWebSocket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

class CopilotViewModel : ViewModel() {
    private val client = CopilotWebSocket()
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val httpClient = OkHttpClient()

    // ── Connection state ──
    data class ConnectionState(
        val connected: Boolean = false,
        val workspaceId: String? = null,
        val sessionId: String? = null,
        val sessions: List<CopilotWebSocket.SessionInfo> = emptyList(),
    )

    private val _connection = MutableStateFlow(ConnectionState())
    val connection: StateFlow<ConnectionState> = _connection.asStateFlow()

    // ── Auth state ──
    data class AuthState(
        val status: String = "checking", // "checking", "setup", "login", "authenticated", "error"
        val username: String? = null,
        val error: String? = null,
    )

    private val _authState = MutableStateFlow(AuthState())
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    // ── Chat — per-session storage ──
    private val sessionChats = mutableMapOf<String, MutableList<ChatItem>>()
    private val _chatItems = MutableStateFlow<List<ChatItem>>(emptyList())
    val chatItems: StateFlow<List<ChatItem>> = _chatItems.asStateFlow()

    private fun currentSessionId(): String? = _connection.value.sessionId
    private fun getSessionChat(sid: String?): MutableList<ChatItem> {
        if (sid == null) return mutableListOf()
        return sessionChats.getOrPut(sid) { mutableListOf() }
    }
    private fun publishChat() {
        _chatItems.value = getSessionChat(currentSessionId()).toList()
    }

    // ── Session state ──
    private val _modes = MutableStateFlow<List<ModeInfo>>(emptyList())
    val modes: StateFlow<List<ModeInfo>> = _modes.asStateFlow()

    private val _currentMode = MutableStateFlow("")
    val currentMode: StateFlow<String> = _currentMode.asStateFlow()

    private val _models = MutableStateFlow<List<ModelInfo>>(emptyList())
    val models: StateFlow<List<ModelInfo>> = _models.asStateFlow()

    private val _currentModel = MutableStateFlow("")
    val currentModel: StateFlow<String> = _currentModel.asStateFlow()

    private val _commands = MutableStateFlow<List<CommandInfo>>(emptyList())
    val commands: StateFlow<List<CommandInfo>> = _commands.asStateFlow()

    private val _configOptions = MutableStateFlow<List<ConfigOption>>(emptyList())
    val configOptions: StateFlow<List<ConfigOption>> = _configOptions.asStateFlow()

    private val _permissions = MutableStateFlow<List<ActivePermission>>(emptyList())
    val permissions: StateFlow<List<ActivePermission>> = _permissions.asStateFlow()

    // Per-session running state
    private val runningSessions = mutableSetOf<String>()
    private val _running = MutableStateFlow(false)
    val running: StateFlow<Boolean> = _running.asStateFlow()
    private fun updateRunning() { _running.value = runningSessions.contains(currentSessionId()) }

    private val _yoloLevel = MutableStateFlow(0)
    val yoloLevel: StateFlow<Int> = _yoloLevel.asStateFlow()

    private val _usage = MutableStateFlow<UsageInfo?>(null)
    val usage: StateFlow<UsageInfo?> = _usage.asStateFlow()

    private val _serverUrl = MutableStateFlow("http://10.0.2.2:8787")
    val serverUrl: StateFlow<String> = _serverUrl.asStateFlow()

    private var agentBuffer = StringBuilder()
    private var thoughtBuffer = StringBuilder()
    private var userBuffer = StringBuilder()
    private var bufferTargetSid: String? = null
    private var replaying = false
    private var replaySessionId: String? = null
    private var eventCollectionJob: Job? = null

    /** Determine which session a message should be routed to */
    private fun resolveTargetSid(data: org.json.JSONObject?): String? {
        val msgSid = data?.optString("sessionId", "")?.takeIf { it.isNotBlank() }
        return msgSid ?: replaySessionId ?: currentSessionId()
    }

    // ── Auth methods ──
    fun checkAuthStatus(serverUrl: String, token: String?) {
        _serverUrl.value = serverUrl
        _authState.value = AuthState(status = "checking")
        
        viewModelScope.launch {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/api/auth/status")
                    .apply {
                        if (token != null) {
                            addHeader("Authorization", "Bearer $token")
                        }
                    }
                    .get()
                    .build()

                withContext(Dispatchers.IO) {
                    httpClient.newCall(request).execute()
                }.use { response ->
                    if (response.isSuccessful) {
                        val body = response.body?.string() ?: "{}"
                        val authStatus = json.decodeFromString<AuthStatus>(body)
                        _authState.value = AuthState(
                            status = authStatus.status,
                            username = authStatus.username
                        )
                    } else {
                        _authState.value = AuthState(status = "error", error = "Server returned ${response.code}")
                    }
                }
            } catch (e: Exception) {
                _authState.value = AuthState(status = "error", error = "Cannot connect: ${e.message}")
            }
        }
    }

    private fun authenticate(
        serverUrl: String,
        endpoint: String,
        username: String,
        password: String,
        statusOnError: String,
        onSuccess: (String, String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                val requestBody = json.encodeToString(AuthRequest.serializer(), 
                    AuthRequest(username, password))
                val request = Request.Builder()
                    .url("$serverUrl/api/auth/$endpoint")
                    .post(requestBody.toRequestBody("application/json".toMediaType()))
                    .build()

                withContext(Dispatchers.IO) {
                    httpClient.newCall(request).execute()
                }.use { response ->
                    val body = response.body?.string() ?: "{}"
                    if (response.isSuccessful) {
                        val authResponse = json.decodeFromString<AuthResponse>(body)
                        _authState.value = AuthState(status = "authenticated", username = authResponse.username)
                        onSuccess(authResponse.token, authResponse.username)
                    } else {
                        val errorResponse = try { json.decodeFromString<ErrorResponse>(body) } catch (_: Exception) { ErrorResponse("${endpoint.replaceFirstChar { it.uppercase() }} failed: ${response.code}") }
                        _authState.value = AuthState(status = statusOnError, error = errorResponse.error)
                    }
                }
            } catch (e: Exception) {
                _authState.value = AuthState(status = statusOnError, error = "Cannot connect: ${e.message}")
            }
        }
    }

    fun setup(serverUrl: String, username: String, password: String, onSuccess: (String, String) -> Unit) {
        authenticate(serverUrl, "setup", username, password, "setup", onSuccess)
    }

    fun login(serverUrl: String, username: String, password: String, onSuccess: (String, String) -> Unit) {
        authenticate(serverUrl, "login", username, password, "login", onSuccess)
    }

    fun logout(serverUrl: String, token: String) {
        viewModelScope.launch {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/api/auth/logout")
                    .addHeader("Authorization", "Bearer $token")
                    .post("{}".toRequestBody("application/json".toMediaType()))
                    .build()
                httpClient.newCall(request).execute().close()
            } catch (_: Exception) {}
        }
        client.disconnect()
        // Full reset on logout
        _connection.value = ConnectionState()
        sessionChats.clear()
        _chatItems.value = emptyList()
        _permissions.value = emptyList()
        runningSessions.clear()
        _running.value = false
        _authState.value = AuthState(status = "login")
    }

    fun setAuthLogin() {
        _authState.value = AuthState(status = "login")
    }

    // ── Connection methods ──
    fun connect(serverUrl: String, authToken: String?, cwd: String? = null, workspaceId: String? = null) {
        _serverUrl.value = serverUrl
        // Cancel previous event collector to prevent duplicates
        eventCollectionJob?.cancel()
        // Keep workspaceId during reconnect — only reset session state
        _connection.update { it.copy(connected = false, sessionId = null, sessions = emptyList()) }
        client.connect(serverUrl, authToken, cwd, workspaceId)

        eventCollectionJob = viewModelScope.launch {
            client.events.collect { event ->
                when (event) {
                    is CopilotWebSocket.Event.Connected -> {
                        _connection.update { it.copy(connected = true) }
                    }
                    is CopilotWebSocket.Event.Disconnected -> {
                        _connection.update { it.copy(connected = false) }
                        runningSessions.clear()
                        updateRunning()
                    }
                    is CopilotWebSocket.Event.Init -> handleInit(event.data)
                    is CopilotWebSocket.Event.ReplayStart -> {
                        replaying = true
                        replaySessionId = event.sessionId ?: currentSessionId()
                        // Clear only the target session's chat for replay
                        val sid = replaySessionId
                        if (sid != null) sessionChats[sid] = mutableListOf()
                        if (sid == currentSessionId()) publishChat()
                        _permissions.value = emptyList()
                        flushBuffers()
                    }
                    is CopilotWebSocket.Event.ReplayEnd -> {
                        flushBuffers()
                        val wasCurrent = replaySessionId == currentSessionId()
                        replaying = false
                        replaySessionId = null
                        if (wasCurrent) publishChat()
                    }
                    is CopilotWebSocket.Event.Chunk -> handleChunk(event.data)
                    is CopilotWebSocket.Event.Tool -> handleTool(event.data)
                    is CopilotWebSocket.Event.ToolUpdate -> handleToolUpdate(event.data)
                    is CopilotWebSocket.Event.Permission -> if (!replaying) handlePermission(event.data)
                    is CopilotWebSocket.Event.SessionCreated -> handleSessionCreated(event.data)
                    is CopilotWebSocket.Event.SessionSwitched -> handleSessionSwitched(event.data)
                    is CopilotWebSocket.Event.UserMessage -> {
                        val text = event.data.optString("text", "")
                        val sid = resolveTargetSid(event.data)
                        if (text.isNotBlank() && sid != null) addChatItem(ChatItem.UserMessage(text), sid)
                    }
                    is CopilotWebSocket.Event.SessionDeleted -> handleSessionDeleted(event.data)
                    is CopilotWebSocket.Event.SessionRenamed -> handleSessionRenamed(event.data)
                    is CopilotWebSocket.Event.Usage -> handleUsage(event.data)
                    is CopilotWebSocket.Event.YoloUpdate -> handleYoloUpdate(event.data)
                    is CopilotWebSocket.Event.ModeUpdate -> handleModeUpdate(event.data)
                    is CopilotWebSocket.Event.ModelUpdate -> handleModelUpdate(event.data)
                    is CopilotWebSocket.Event.ConfigUpdate -> handleConfigUpdate(event.data)
                    is CopilotWebSocket.Event.PromptStart -> {
                        if (!replaying) {
                            val sid = event.sessionId ?: currentSessionId()
                            if (sid != null) runningSessions.add(sid)
                            updateRunning()
                        }
                    }
                    is CopilotWebSocket.Event.PromptEnd -> {
                        flushBuffers()
                        if (!replaying) {
                            val sid = event.sessionId ?: currentSessionId()
                            if (sid != null) runningSessions.remove(sid)
                            updateRunning()
                        }
                    }
                    is CopilotWebSocket.Event.Done -> {
                        flushBuffers()
                        val stopReason = event.data.optString("stopReason", "completed")
                        val sid = resolveTargetSid(event.data)
                        if (sid != null) addChatItem(ChatItem.Done(stopReason), sid)
                    }
                    is CopilotWebSocket.Event.Error -> {
                        val sid = resolveTargetSid(null)
                        if (!replaying && sid != null) addChatItem(ChatItem.Error(event.message), sid)
                    }
                    is CopilotWebSocket.Event.Status -> {
                        val msg = event.data.optString("message", "")
                        val level = event.data.optString("level", "info")
                        val sid = resolveTargetSid(event.data)
                        if (msg.isNotBlank() && level != "debug" && !replaying && sid != null) {
                            addChatItem(ChatItem.Status(msg), sid)
                        }
                    }
                    is CopilotWebSocket.Event.AuthRequired -> {
                        _authState.value = AuthState(status = "login", error = "Session expired, please sign in again")
                        disconnect()
                    }
                    is CopilotWebSocket.Event.PermissionResolved -> {
                        _permissions.update { it.filter { p -> p.requestId != event.requestId } }
                    }
                }
            }
        }
    }

    fun disconnect() {
        client.disconnect()
        // Preserve workspaceId so we can reconnect to the same workspace
        _connection.update { it.copy(connected = false, sessionId = null, sessions = emptyList()) }
    }

    fun sendPrompt(text: String) {
        val sid = currentSessionId()
        if (text.isBlank() || (sid != null && runningSessions.contains(sid))) return
        flushBuffers()
        addChatItem(ChatItem.UserMessage(text))
        client.sendPrompt(text)
    }

    fun respondPermission(requestId: String, optionId: String, feedback: String? = null) {
        client.sendPermissionResponse(requestId, optionId, feedback?.takeIf { it.isNotBlank() })
        _permissions.update { it.filter { p -> p.requestId != requestId } }
    }

    fun cancelPermission(requestId: String) {
        client.sendPermissionResponse(requestId, null)
        _permissions.update { it.filter { p -> p.requestId != requestId } }
    }

    fun setMode(modeId: String) { client.setMode(modeId) }
    fun setModel(modelId: String) { client.setModel(modelId) }
    fun setYoloLevel(level: Int) {
        _yoloLevel.value = level
        client.setYoloLevel(level)
    }
    fun setConfigOption(configId: String, value: Any) {
        client.setConfigOption(configId, value)
    }
    fun cancel() { client.sendCancel() }

    fun createNewSession(cwd: String? = null, title: String? = null) {
        client.createSession(cwd, title)
    }

    fun switchSession(sessionId: String) {
        // Save current buffers before switching
        flushBuffers()
        _permissions.value = emptyList()
        // Don't clear chat — switchSession will trigger session_switched + replay
        client.switchSession(sessionId)
    }

    fun deleteSession(sessionId: String) {
        client.deleteSession(sessionId)
    }

    fun renameSession(sessionId: String, title: String) {
        client.renameSession(sessionId, title)
    }

    // ── Message handlers ──
    private fun handleInit(data: org.json.JSONObject) {
        val workspaceId = data.optString("workspaceId")
        val sessionId = data.optString("sessionId")
        val isReconnect = data.optBoolean("isReconnect", false)
        
        _connection.update { it.copy(workspaceId = workspaceId, sessionId = sessionId) }

        // Parse sessions
        val sessionsArray = data.optJSONArray("sessions")
        if (sessionsArray != null) {
            val sessions = (0 until sessionsArray.length()).map { i ->
                val s = sessionsArray.getJSONObject(i)
                CopilotWebSocket.SessionInfo(
                    sessionId = s.optString("sessionId"),
                    cwd = s.optString("cwd"),
                    title = s.optString("title"),
                    active = s.optBoolean("active"),
                    busy = s.optBoolean("busy"),
                )
            }
            _connection.update { it.copy(sessions = sessions) }
        }

        // Parse modes
        val modesObj = data.optJSONObject("modes")
        if (modesObj != null) {
            val modesArray = modesObj.optJSONArray("availableModes")
            if (modesArray != null) {
                _modes.value = (0 until modesArray.length()).mapNotNull { i ->
                    try {
                        val m = modesArray.getJSONObject(i)
                        ModeInfo(
                            id = m.optString("id"),
                            name = m.optString("name"),
                            description = m.optString("description")
                        )
                    } catch (_: Exception) { null }
                }
            }
            _currentMode.value = modesObj.optString("currentModeId", "")
        }

        // Parse models
        val modelsObj = data.optJSONObject("models")
        if (modelsObj != null) {
            val modelsArray = modelsObj.optJSONArray("availableModels")
            if (modelsArray != null) {
                _models.value = (0 until modelsArray.length()).mapNotNull { i ->
                    try {
                        val m = modelsArray.getJSONObject(i)
                        ModelInfo(
                            modelId = m.optString("modelId"),
                            name = m.optString("name"),
                            description = m.optString("description")
                        )
                    } catch (_: Exception) { null }
                }
            }
            _currentModel.value = modelsObj.optString("currentModelId", "")
        }

        // Parse config options
        val configArray = data.optJSONArray("configOptions")
        if (configArray != null) {
            _configOptions.value = (0 until configArray.length()).mapNotNull { i ->
                try {
                    val jsonStr = configArray.getJSONObject(i).toString()
                    json.decodeFromString<ConfigOption>(jsonStr)
                } catch (_: Exception) { null }
            }
        }

        // Parse yolo level
        _yoloLevel.value = data.optInt("yoloLevel", 0)

        if (!isReconnect) {
            val cwd = data.optString("cwd", "")
            if (cwd.isNotBlank()) {
                addChatItem(ChatItem.Status("Connected to workspace: $cwd"))
            } else {
                addChatItem(ChatItem.Status("Connected"))
            }
        } else {
            addChatItem(ChatItem.Status("Reconnected"))
        }
    }

    private fun handleChunk(data: org.json.JSONObject) {
        val role = data.optString("role", "")
        val text = data.optString("text", "")
        val targetSid = resolveTargetSid(data) ?: return
        
        // If buffers target a different session, flush first
        if (bufferTargetSid != null && bufferTargetSid != targetSid) {
            flushBuffers()
        }
        bufferTargetSid = targetSid
        
        when (role) {
            "agent" -> {
                flushThought()
                flushUser()
                agentBuffer.append(text)
                updateLastAgent(targetSid)
            }
            "thought" -> {
                flushUser()
                thoughtBuffer.append(text)
                updateLastThought(targetSid)
            }
            "user" -> {
                userBuffer.append(text)
                updateLastUser(targetSid)
            }
        }
    }

    private fun handleTool(data: org.json.JSONObject) {
        flushBuffers()
        val targetSid = resolveTargetSid(data) ?: return
        val toolCallId = data.optString("toolCallId", "")
        val title = data.optString("title", "")
        val kind = data.optString("kind", "other")
        val status = data.optString("status", "pending")
        
        updateOrAddToolCall(toolCallId, targetSid) {
            ChatItem.ToolCall(
                toolCallId = toolCallId,
                title = title,
                kind = kind,
                status = status,
            )
        }
    }

    private fun handleToolUpdate(data: org.json.JSONObject) {
        val targetSid = resolveTargetSid(data) ?: return
        val toolCallId = data.optString("toolCallId", "")
        val title = data.optString("title", "")
        val status = data.optString("status", "")
        val contentArray = data.optJSONArray("content")
        val content = if (contentArray != null) {
            (0 until contentArray.length()).joinToString("\n") { i ->
                val c = contentArray.optJSONObject(i)
                c?.optString("text", "") ?: ""
            }
        } else ""
        
        updateOrAddToolCall(toolCallId, targetSid) { existing ->
            ChatItem.ToolCall(
                toolCallId = toolCallId,
                title = if (title.isNotBlank()) title else existing?.title ?: "",
                kind = existing?.kind ?: "other",
                status = if (status.isNotBlank()) status else existing?.status ?: "pending",
                contentText = if (content.isNotBlank()) content else existing?.contentText ?: "",
            )
        }
    }

    private fun handlePermission(data: org.json.JSONObject) {
        val requestId = data.optString("requestId", "")
        val title = data.optString("title", "Permission request")
        val optionsArray = data.optJSONArray("options")
        val options = if (optionsArray != null) {
            (0 until optionsArray.length()).mapNotNull { i ->
                try {
                    val o = optionsArray.getJSONObject(i)
                    PermissionOption(
                        optionId = o.optString("optionId"),
                        name = o.optString("name"),
                        kind = o.optString("kind"),
                    )
                } catch (_: Exception) { null }
            }
        } else emptyList()

        _permissions.update {
            it + ActivePermission(
                requestId = requestId,
                title = title,
                options = options,
            )
        }
    }

    private fun handleSessionCreated(data: org.json.JSONObject) {
        val sessionId = data.optString("sessionId")
        val title = data.optString("title")
        flushBuffers()
        _permissions.value = emptyList()
        _connection.update { it.copy(sessionId = sessionId) }
        // New session starts with empty chat
        sessionChats[sessionId] = mutableListOf()
        publishChat()
        updateRunning()
        addChatItem(ChatItem.Status("Session created: $title"))
        
        // Update sessions list
        parseSessions(data)
    }

    private fun handleSessionSwitched(data: org.json.JSONObject) {
        val sessionId = data.optString("sessionId")
        _permissions.value = emptyList()
        flushBuffers()
        _connection.update { it.copy(sessionId = sessionId) }
        // Publish the stored chat for the new session (replay will repopulate)
        publishChat()
        updateRunning()
        
        // Update sessions list
        parseSessions(data)
    }

    private fun handleSessionDeleted(data: org.json.JSONObject) {
        val deletedId = data.optString("deletedSessionId")
        val sessionId = data.optString("sessionId")
        sessionChats.remove(deletedId)
        runningSessions.remove(deletedId)
        _connection.update { it.copy(sessionId = sessionId) }
        publishChat()
        updateRunning()
        addChatItem(ChatItem.Status("Session deleted"))
        
        // Update sessions list
        parseSessions(data)
    }

    private fun handleSessionRenamed(data: org.json.JSONObject) {
        parseSessions(data)
    }

    private fun parseSessions(data: org.json.JSONObject) {
        val sessionsArray = data.optJSONArray("sessions")
        if (sessionsArray != null) {
            val sessions = (0 until sessionsArray.length()).map { i ->
                val s = sessionsArray.getJSONObject(i)
                CopilotWebSocket.SessionInfo(
                    sessionId = s.optString("sessionId"),
                    cwd = s.optString("cwd"),
                    title = s.optString("title"),
                    active = s.optBoolean("active"),
                    busy = s.optBoolean("busy"),
                )
            }
            _connection.update { it.copy(sessions = sessions) }
        }
    }

    private fun handleUsage(data: org.json.JSONObject) {
        val usageObj = data.optJSONObject("usage")
        if (usageObj != null) {
            try {
                _usage.value = json.decodeFromString<UsageInfo>(usageObj.toString())
            } catch (_: Exception) {}
        }
    }

    private fun handleYoloUpdate(data: org.json.JSONObject) {
        _yoloLevel.value = data.optInt("level", 0)
    }

    private fun handleModeUpdate(data: org.json.JSONObject) {
        _currentMode.value = data.optString("modeId", "")
    }

    private fun handleModelUpdate(data: org.json.JSONObject) {
        _currentModel.value = data.optString("modelId", "")
        val modelsArray = data.optJSONArray("availableModels")
        if (modelsArray != null) {
            _models.value = (0 until modelsArray.length()).mapNotNull { i ->
                try {
                    val m = modelsArray.getJSONObject(i)
                    ModelInfo(
                        modelId = m.optString("modelId"),
                        name = m.optString("name"),
                        description = m.optString("description")
                    )
                } catch (_: Exception) { null }
            }
        }
    }

    private fun handleConfigUpdate(data: org.json.JSONObject) {
        val configArray = data.optJSONArray("configOptions")
        if (configArray != null) {
            _configOptions.value = (0 until configArray.length()).mapNotNull { i ->
                try {
                    val jsonStr = configArray.getJSONObject(i).toString()
                    json.decodeFromString<ConfigOption>(jsonStr)
                } catch (_: Exception) { null }
            }
        }
    }

    // ── UI helpers ──
    private fun addChatItem(item: ChatItem, sid: String? = null) {
        val targetSid = sid ?: currentSessionId() ?: return
        getSessionChat(targetSid).add(item)
        if (!replaying && targetSid == currentSessionId()) publishChat()
    }

    private fun updateLastAgent(sid: String? = null) {
        val text = agentBuffer.toString()
        val targetSid = sid ?: bufferTargetSid ?: currentSessionId() ?: return
        val chat = getSessionChat(targetSid)
        val idx = chat.size - 1
        if (idx >= 0 && chat[idx] is ChatItem.AgentMessage) {
            chat[idx] = (chat[idx] as ChatItem.AgentMessage).copy(text = text)
        } else {
            chat.add(ChatItem.AgentMessage(text))
        }
        if (!replaying && targetSid == currentSessionId()) publishChat()
    }

    private fun updateLastThought(sid: String? = null) {
        val text = thoughtBuffer.toString()
        val targetSid = sid ?: bufferTargetSid ?: currentSessionId() ?: return
        val chat = getSessionChat(targetSid)
        val idx = chat.size - 1
        if (idx >= 0 && chat[idx] is ChatItem.ThoughtMessage) {
            chat[idx] = (chat[idx] as ChatItem.ThoughtMessage).copy(text = text)
        } else {
            chat.add(ChatItem.ThoughtMessage(text))
        }
        if (!replaying && targetSid == currentSessionId()) publishChat()
    }

    private fun updateLastUser(sid: String? = null) {
        val text = userBuffer.toString()
        val targetSid = sid ?: bufferTargetSid ?: currentSessionId() ?: return
        val chat = getSessionChat(targetSid)
        val idx = chat.size - 1
        if (idx >= 0 && chat[idx] is ChatItem.UserMessage) {
            chat[idx] = (chat[idx] as ChatItem.UserMessage).copy(text = text)
        } else {
            chat.add(ChatItem.UserMessage(text))
        }
        if (!replaying && targetSid == currentSessionId()) publishChat()
    }

    private fun updateOrAddToolCall(id: String, sid: String? = null, update: (ChatItem.ToolCall?) -> ChatItem.ToolCall) {
        val targetSid = sid ?: currentSessionId() ?: return
        val chat = getSessionChat(targetSid)
        val idx = chat.indexOfLast { it is ChatItem.ToolCall && it.toolCallId == id }
        if (idx >= 0) {
            chat[idx] = update(chat[idx] as ChatItem.ToolCall)
        } else {
            chat.add(update(null))
        }
        if (!replaying && targetSid == currentSessionId()) publishChat()
    }

    private fun flushBuffers() { flushAgent(); flushThought(); flushUser(); bufferTargetSid = null }
    private fun flushAgent() { if (agentBuffer.isNotEmpty()) agentBuffer.clear() }
    private fun flushThought() { if (thoughtBuffer.isNotEmpty()) thoughtBuffer.clear() }
    private fun flushUser() { if (userBuffer.isNotEmpty()) userBuffer.clear() }

    override fun onCleared() {
        eventCollectionJob?.cancel()
        client.disconnect()
        httpClient.dispatcher.executorService.shutdown()
        httpClient.connectionPool.evictAll()
        super.onCleared()
    }
}
