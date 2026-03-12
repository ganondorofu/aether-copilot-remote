package com.copilot.remote.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.copilot.remote.model.*
import com.copilot.remote.network.CopilotWebSocket
import kotlinx.coroutines.Dispatchers
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

    // ── Chat ──
    private val _chatItems = MutableStateFlow<List<ChatItem>>(emptyList())
    val chatItems: StateFlow<List<ChatItem>> = _chatItems.asStateFlow()

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

    private val _running = MutableStateFlow(false)
    val running: StateFlow<Boolean> = _running.asStateFlow()

    private val _yoloLevel = MutableStateFlow(0)
    val yoloLevel: StateFlow<Int> = _yoloLevel.asStateFlow()

    private val _usage = MutableStateFlow<UsageInfo?>(null)
    val usage: StateFlow<UsageInfo?> = _usage.asStateFlow()

    private val _serverUrl = MutableStateFlow("http://10.0.2.2:8787")
    val serverUrl: StateFlow<String> = _serverUrl.asStateFlow()

    private var agentBuffer = StringBuilder()
    private var thoughtBuffer = StringBuilder()
    private var userBuffer = StringBuilder()
    private var replaying = false

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

    fun setup(serverUrl: String, username: String, password: String, onSuccess: (String, String) -> Unit) {
        viewModelScope.launch {
            try {
                val requestBody = json.encodeToString(AuthRequest.serializer(), 
                    AuthRequest(username, password))
                val request = Request.Builder()
                    .url("$serverUrl/api/auth/setup")
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
                        val errorResponse = try { json.decodeFromString<ErrorResponse>(body) } catch (_: Exception) { ErrorResponse("Setup failed: ${response.code}") }
                        _authState.value = AuthState(status = "setup", error = errorResponse.error)
                    }
                }
            } catch (e: Exception) {
                _authState.value = AuthState(status = "setup", error = "Cannot connect: ${e.message}")
            }
        }
    }

    fun login(serverUrl: String, username: String, password: String, onSuccess: (String, String) -> Unit) {
        viewModelScope.launch {
            try {
                val requestBody = json.encodeToString(AuthRequest.serializer(), 
                    AuthRequest(username, password))
                val request = Request.Builder()
                    .url("$serverUrl/api/auth/login")
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
                        val errorResponse = try { json.decodeFromString<ErrorResponse>(body) } catch (_: Exception) { ErrorResponse("Login failed: ${response.code}") }
                        _authState.value = AuthState(status = "login", error = errorResponse.error)
                    }
                }
            } catch (e: Exception) {
                _authState.value = AuthState(status = "login", error = "Cannot connect: ${e.message}")
            }
        }
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
        disconnect()
        _authState.value = AuthState(status = "login")
    }

    fun setAuthLogin() {
        _authState.value = AuthState(status = "login")
    }

    // ── Connection methods ──
    fun connect(serverUrl: String, authToken: String?, cwd: String? = null, workspaceId: String? = null) {
        _serverUrl.value = serverUrl
        _connection.value = ConnectionState()
        client.connect(serverUrl, authToken, cwd, workspaceId)

        viewModelScope.launch {
            client.events.collect { event ->
                when (event) {
                    is CopilotWebSocket.Event.Connected -> {
                        _connection.update { it.copy(connected = true) }
                    }
                    is CopilotWebSocket.Event.Disconnected -> {
                        _connection.update { it.copy(connected = false) }
                        _running.value = false
                    }
                    is CopilotWebSocket.Event.Init -> handleInit(event.data)
                    is CopilotWebSocket.Event.ReplayStart -> {
                        replaying = true
                        _chatItems.value = emptyList()
                        _permissions.value = emptyList()
                        flushBuffers()
                    }
                    is CopilotWebSocket.Event.ReplayEnd -> {
                        flushBuffers()
                        replaying = false
                    }
                    is CopilotWebSocket.Event.Chunk -> handleChunk(event.data)
                    is CopilotWebSocket.Event.Tool -> handleTool(event.data)
                    is CopilotWebSocket.Event.ToolUpdate -> handleToolUpdate(event.data)
                    is CopilotWebSocket.Event.Permission -> if (!replaying) handlePermission(event.data)
                    is CopilotWebSocket.Event.SessionCreated -> handleSessionCreated(event.data)
                    is CopilotWebSocket.Event.SessionSwitched -> handleSessionSwitched(event.data)
                    is CopilotWebSocket.Event.SessionDeleted -> handleSessionDeleted(event.data)
                    is CopilotWebSocket.Event.SessionRenamed -> handleSessionRenamed(event.data)
                    is CopilotWebSocket.Event.Usage -> handleUsage(event.data)
                    is CopilotWebSocket.Event.YoloUpdate -> handleYoloUpdate(event.data)
                    is CopilotWebSocket.Event.ModeUpdate -> handleModeUpdate(event.data)
                    is CopilotWebSocket.Event.ModelUpdate -> handleModelUpdate(event.data)
                    is CopilotWebSocket.Event.ConfigUpdate -> handleConfigUpdate(event.data)
                    is CopilotWebSocket.Event.PromptStart -> if (!replaying) _running.value = true
                    is CopilotWebSocket.Event.PromptEnd -> {
                        flushBuffers()
                        if (!replaying) _running.value = false
                    }
                    is CopilotWebSocket.Event.Error -> {
                        if (!replaying) addChatItem(ChatItem.Error(event.message))
                    }
                    is CopilotWebSocket.Event.Status -> {
                        val msg = event.data.optString("message", "")
                        val level = event.data.optString("level", "info")
                        if (msg.isNotBlank() && level != "debug" && !replaying) {
                            addChatItem(ChatItem.Status(msg))
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
        _connection.value = ConnectionState()
    }

    fun sendPrompt(text: String) {
        if (text.isBlank() || _running.value) return
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
        _chatItems.value = emptyList()
        _permissions.value = emptyList()
        _running.value = false
        flushBuffers()
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
        
        when (role) {
            "agent" -> {
                flushThought()
                flushUser()
                agentBuffer.append(text)
                updateLastAgent()
            }
            "thought" -> {
                flushUser()
                thoughtBuffer.append(text)
                updateLastThought()
            }
            "user" -> {
                userBuffer.append(text)
                updateLastUser()
            }
        }
    }

    private fun handleTool(data: org.json.JSONObject) {
        flushBuffers()
        val toolCallId = data.optString("toolCallId", "")
        val title = data.optString("title", "")
        val kind = data.optString("kind", "other")
        val status = data.optString("status", "pending")
        
        updateOrAddToolCall(toolCallId) {
            ChatItem.ToolCall(
                toolCallId = toolCallId,
                title = title,
                kind = kind,
                status = status,
            )
        }
    }

    private fun handleToolUpdate(data: org.json.JSONObject) {
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
        
        updateOrAddToolCall(toolCallId) { existing ->
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
        _connection.update { it.copy(sessionId = sessionId) }
        addChatItem(ChatItem.Status("Session created: $title"))
        
        // Update sessions list
        parseSessions(data)
    }

    private fun handleSessionSwitched(data: org.json.JSONObject) {
        val sessionId = data.optString("sessionId")
        val title = data.optString("title")
        _connection.update { it.copy(sessionId = sessionId) }
        addChatItem(ChatItem.Status("Switched to: $title"))
        
        // Update sessions list
        parseSessions(data)
    }

    private fun handleSessionDeleted(data: org.json.JSONObject) {
        val deletedId = data.optString("deletedSessionId")
        val sessionId = data.optString("sessionId")
        _connection.update { it.copy(sessionId = sessionId) }
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
    private fun addChatItem(item: ChatItem) {
        _chatItems.update { it + item }
    }

    private fun updateLastAgent() {
        val text = agentBuffer.toString()
        _chatItems.update { items ->
            val last = items.lastOrNull()
            if (last is ChatItem.AgentMessage) {
                items.toMutableList().apply { set(lastIndex, last.copy(text = text)) }
            } else items + ChatItem.AgentMessage(text)
        }
    }

    private fun updateLastThought() {
        val text = thoughtBuffer.toString()
        _chatItems.update { items ->
            val last = items.lastOrNull()
            if (last is ChatItem.ThoughtMessage) {
                items.toMutableList().apply { set(lastIndex, last.copy(text = text)) }
            } else items + ChatItem.ThoughtMessage(text)
        }
    }

    private fun updateLastUser() {
        val text = userBuffer.toString()
        _chatItems.update { items ->
            val last = items.lastOrNull()
            if (last is ChatItem.UserMessage) {
                items.toMutableList().apply { set(lastIndex, last.copy(text = text)) }
            } else items + ChatItem.UserMessage(text)
        }
    }

    private fun updateOrAddToolCall(id: String, update: (ChatItem.ToolCall?) -> ChatItem.ToolCall) {
        _chatItems.update { items ->
            val idx = items.indexOfLast { it is ChatItem.ToolCall && it.toolCallId == id }
            if (idx >= 0) {
                items.toMutableList().apply { set(idx, update(items[idx] as ChatItem.ToolCall)) }
            } else items + update(null)
        }
    }

    private fun flushBuffers() { flushAgent(); flushThought(); flushUser() }
    private fun flushAgent() { if (agentBuffer.isNotEmpty()) agentBuffer.clear() }
    private fun flushThought() { if (thoughtBuffer.isNotEmpty()) thoughtBuffer.clear() }
    private fun flushUser() { if (userBuffer.isNotEmpty()) userBuffer.clear() }

    override fun onCleared() {
        client.disconnect()
        super.onCleared()
    }
}
