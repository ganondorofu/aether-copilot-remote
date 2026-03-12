package com.copilot.remote.network

import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.json.JSONArray
import org.json.JSONObject

/**
 * Socket.IO client for connecting to Copilot Remote UI server (start.js).
 * Matches Web client implementation (public/app.js).
 */
class CopilotWebSocket(
    private val json: Json = Json { ignoreUnknownKeys = true; isLenient = true },
) {
    private var socket: Socket? = null
    private var workspaceId: String? = null
    private var activeSessionId: String? = null

    sealed class Event {
        data object Connected : Event()
        data object Disconnected : Event()
        data class Init(val data: JSONObject) : Event()
        data class Chunk(val data: JSONObject) : Event()
        data class Tool(val data: JSONObject) : Event()
        data class ToolUpdate(val data: JSONObject) : Event()
        data class Permission(val data: JSONObject) : Event()
        data class SessionCreated(val data: JSONObject) : Event()
        data class SessionSwitched(val data: JSONObject) : Event()
        data class SessionDeleted(val data: JSONObject) : Event()
        data class SessionRenamed(val data: JSONObject) : Event()
        data class Usage(val data: JSONObject) : Event()
        data class YoloUpdate(val data: JSONObject) : Event()
        data class ModeUpdate(val data: JSONObject) : Event()
        data class ModelUpdate(val data: JSONObject) : Event()
        data class ConfigUpdate(val data: JSONObject) : Event()
        data class PromptStart(val sessionId: String?) : Event()
        data class PromptEnd(val sessionId: String?) : Event()
        data class Done(val data: JSONObject) : Event()
        data class ReplayStart(val sessionId: String?) : Event()
        data class ReplayEnd(val sessionId: String?) : Event()
        data class Error(val message: String) : Event()
        data class Status(val data: JSONObject) : Event()
        data class AuthRequired(val message: String) : Event()
        data class UserMessage(val data: JSONObject) : Event()
        data class PermissionResolved(val requestId: String) : Event()
    }

    data class SessionInfo(
        val sessionId: String,
        val cwd: String,
        val title: String,
        val active: Boolean,
        val busy: Boolean,
    )

    private val _events = Channel<Event>(Channel.UNLIMITED)
    val events: Flow<Event> = _events.receiveAsFlow()

    fun connect(serverUrl: String, authToken: String?, cwd: String? = null, savedWorkspaceId: String? = null) {
        disconnect()
        
        workspaceId = savedWorkspaceId

        val opts = IO.Options().apply {
            reconnection = true
            reconnectionAttempts = 10
            reconnectionDelay = 2000
            timeout = 15000
            if (authToken != null) {
                auth = mapOf("token" to authToken)
            }
        }

        socket = IO.socket(serverUrl, opts).apply {
            on(Socket.EVENT_CONNECT) {
                _events.trySend(Event.Connected)
                // Auto-connect with workspace info
                emit("auto_connect", JSONObject().apply {
                    put("workspaceId", workspaceId ?: JSONObject.NULL)
                    put("cwd", cwd ?: JSONObject.NULL)
                })
            }

            on(Socket.EVENT_DISCONNECT) {
                _events.trySend(Event.Disconnected)
            }

            on(Socket.EVENT_CONNECT_ERROR) { args ->
                val err = args.firstOrNull()
                val errMsg = err?.toString() ?: "unknown"
                if (errMsg.contains("auth_required") || errMsg.contains("auth_invalid")) {
                    _events.trySend(Event.AuthRequired(errMsg))
                }
                // Other errors are transient; Socket.IO will auto-reconnect
            }

            // All server messages come through "msg" event
            on("msg") { args ->
                val data = args.firstOrNull() as? JSONObject ?: return@on
                handleMessage(data)
            }

            connect()
        }
    }

    private fun handleMessage(data: JSONObject) {
        val type = data.optString("type", "")
        when (type) {
            "init" -> {
                workspaceId = data.optString("workspaceId", workspaceId)
                activeSessionId = data.optString("sessionId", activeSessionId)
                _events.trySend(Event.Init(data))
            }
            "chunk" -> _events.trySend(Event.Chunk(data))
            "tool" -> _events.trySend(Event.Tool(data))
            "tool_update" -> _events.trySend(Event.ToolUpdate(data))
            "permission" -> _events.trySend(Event.Permission(data))
            "session_created" -> {
                activeSessionId = data.optString("sessionId", activeSessionId)
                _events.trySend(Event.SessionCreated(data))
            }
            "session_switched" -> {
                activeSessionId = data.optString("sessionId", activeSessionId)
                _events.trySend(Event.SessionSwitched(data))
            }
            "session_deleted" -> {
                activeSessionId = data.optString("sessionId", activeSessionId)
                _events.trySend(Event.SessionDeleted(data))
            }
            "session_renamed" -> _events.trySend(Event.SessionRenamed(data))
            "usage" -> _events.trySend(Event.Usage(data))
            "yolo_update" -> _events.trySend(Event.YoloUpdate(data))
            "mode_update" -> _events.trySend(Event.ModeUpdate(data))
            "model_update" -> _events.trySend(Event.ModelUpdate(data))
            "config_update" -> _events.trySend(Event.ConfigUpdate(data))
            "prompt_start" -> _events.trySend(Event.PromptStart(data.optString("sessionId", null)))
            "prompt_end" -> _events.trySend(Event.PromptEnd(data.optString("sessionId", null)))
            "done" -> _events.trySend(Event.Done(data))
            "error" -> _events.trySend(Event.Error(data.optString("message", "Unknown error")))
            "status" -> _events.trySend(Event.Status(data))
            "replay_start" -> _events.trySend(Event.ReplayStart(data.optString("sessionId", null)))
            "replay_end" -> _events.trySend(Event.ReplayEnd(data.optString("sessionId", null)))
            "permission_resolved" -> {
                val rid = data.optString("requestId", "")
                if (rid.isNotBlank()) _events.trySend(Event.PermissionResolved(rid))
            }
            "auto_approved", "stderr" -> { /* ignore */ }
            "user_message" -> _events.trySend(Event.UserMessage(data))
            else -> { /* unknown message type */ }
        }
    }

    fun sendPrompt(text: String, attachments: List<JSONObject> = emptyList()) {
        socket?.emit("prompt", JSONObject().apply {
            put("text", text)
            put("sessionId", activeSessionId ?: JSONObject.NULL)
            if (attachments.isNotEmpty()) {
                put("attachments", JSONArray(attachments))
            }
        })
    }

    fun sendPermissionResponse(requestId: String, optionId: String?, feedback: String? = null) {
        socket?.emit("permission_response", JSONObject().apply {
            put("requestId", requestId)
            if (optionId != null) {
                put("optionId", optionId)
            }
            put("sessionId", activeSessionId ?: JSONObject.NULL)
            if (!feedback.isNullOrBlank()) {
                put("feedback", feedback)
            }
        })
    }

    fun sendCancel() {
        socket?.emit("cancel", JSONObject().apply {
            put("sessionId", activeSessionId ?: JSONObject.NULL)
        })
    }

    fun setYoloLevel(level: Int) {
        socket?.emit("set_yolo", JSONObject().apply {
            put("level", level)
        })
    }

    fun setMode(modeId: String) {
        socket?.emit("set_mode", JSONObject().apply {
            put("modeId", modeId)
            put("sessionId", activeSessionId ?: JSONObject.NULL)
        })
    }

    fun setModel(modelId: String) {
        socket?.emit("set_model", JSONObject().apply {
            put("modelId", modelId)
            put("sessionId", activeSessionId ?: JSONObject.NULL)
        })
    }

    fun setConfigOption(configId: String, value: Any, valueType: String? = null) {
        socket?.emit("set_config_option", JSONObject().apply {
            put("configId", configId)
            put("value", value)
            if (valueType != null) {
                put("valueType", valueType)
            }
            put("sessionId", activeSessionId ?: JSONObject.NULL)
        })
    }

    fun createSession(cwd: String? = null, title: String? = null) {
        socket?.emit("create_session", JSONObject().apply {
            if (cwd != null) put("cwd", cwd)
            if (title != null) put("title", title)
        })
    }

    fun switchSession(sessionId: String) {
        socket?.emit("switch_session", JSONObject().apply {
            put("sessionId", sessionId)
        })
    }

    fun deleteSession(sessionId: String) {
        socket?.emit("delete_session", JSONObject().apply {
            put("sessionId", sessionId)
        })
    }

    fun renameSession(sessionId: String, title: String) {
        socket?.emit("rename_session", JSONObject().apply {
            put("sessionId", sessionId)
            put("title", title)
        })
    }

    fun destroyWorkspace() {
        socket?.emit("destroy_workspace", JSONObject())
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        activeSessionId = null
        workspaceId = null
    }

    fun isConnected(): Boolean = socket?.connected() == true
    
    fun getWorkspaceId(): String? = workspaceId
    fun getActiveSessionId(): String? = activeSessionId
}
