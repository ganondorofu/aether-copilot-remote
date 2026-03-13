package com.copilot.remote.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

// ── Messages FROM server ──

@Serializable
data class InitMessage(
    val type: String = "init",
    val sessionId: String? = null,
    val protocolVersion: Int? = null,
    val modes: ModeState? = null,
    val models: ModelState? = null,
    val configOptions: List<ConfigOption>? = null,
)

@Serializable
data class ModeState(
    val availableModes: List<ModeInfo> = emptyList(),
    val currentModeId: String = "",
)

@Serializable
data class ModeInfo(
    val id: String,
    val name: String = "",
    val description: String? = null,
)

@Serializable
data class ModelState(
    val availableModels: List<ModelInfo> = emptyList(),
    val currentModelId: String = "",
)

@Serializable
data class ModelInfo(
    val modelId: String,
    val name: String? = null,
    val description: String? = null,
    val copilotUsage: String? = null,
)

@Serializable
data class ConfigOption(
    val id: String,
    val name: String? = null,
    val description: String? = null,
    val type: String? = null,
    val value: JsonElement? = null,
    val currentValue: String? = null,
    val category: String? = null,
    val options: JsonElement? = null,
) {
    val configId: String get() = id
}

@Serializable
data class ChunkMessage(
    val type: String = "chunk",
    val role: String? = null,
    val contentType: String? = null,
    val text: String? = null,
)

@Serializable
data class ToolMessage(
    val type: String,
    val toolCallId: String? = null,
    val title: String? = null,
    val kind: String? = null,
    val status: String? = null,
    val content: List<JsonElement>? = null,
    val locations: List<ToolLocation>? = null,
)

@Serializable
data class ToolLocation(
    val path: String,
    val line: Int? = null,
)

@Serializable
data class PlanMessage(
    val type: String = "plan",
    val entries: List<PlanEntry> = emptyList(),
)

@Serializable
data class PlanEntry(
    val content: String,
    val priority: String? = "medium",
    val status: String = "pending",
)

@Serializable
data class PermissionMessage(
    val type: String = "permission",
    val requestId: String,
    val title: String? = null,
    val toolCall: ToolCallDetail? = null,
    val options: List<PermissionOption> = emptyList(),
)

@Serializable
data class ToolCallDetail(
    val toolCallId: String? = null,
    val title: String? = null,
    val kind: String? = null,
    val status: String? = null,
    val content: List<JsonElement>? = null,
    val locations: List<ToolLocation>? = null,
    val rawInput: JsonElement? = null,
)

@Serializable
data class PermissionOption(
    val optionId: String,
    val name: String? = null,
    val kind: String? = null,
)

@Serializable
data class CommandInfo(
    val name: String,
    val description: String = "",
    val hasInput: Boolean = false,
)

@Serializable
data class DoneMessage(
    val type: String = "done",
    val stopReason: String? = null,
)

@Serializable
data class ErrorMessage(
    val type: String = "error",
    val message: String? = null,
)

@Serializable
data class StatusMessage(
    val type: String = "status",
    val message: String? = null,
    val level: String? = null,
)

@Serializable
data class ModeUpdateMessage(
    val type: String = "mode_update",
    val modeId: String? = null,
)

@Serializable
data class ModelUpdateMessage(
    val type: String = "model_update",
    val modelId: String? = null,
    val availableModels: List<ModelInfo>? = null,
)

@Serializable
data class CommandsMessage(
    val type: String = "commands",
    val commands: List<CommandInfo> = emptyList(),
)

@Serializable
data class ConfigUpdateMessage(
    val type: String = "config_update",
    val configOptions: List<ConfigOption> = emptyList(),
)

// ── Messages TO server ──

@Serializable
data class PromptRequest(
    val type: String = "prompt",
    val text: String,
)

@Serializable
data class PermissionResponse(
    val type: String = "permission_response",
    val requestId: String,
    val optionId: String? = null,
    val feedback: String? = null,
)

@Serializable
data class SetModeRequest(
    val type: String = "set_mode",
    val modeId: String,
)

@Serializable
data class SetModelRequest(
    val type: String = "set_model",
    val modelId: String,
)

@Serializable
data class CancelRequest(
    val type: String = "cancel",
)

@Serializable
data class SetConfigRequest(
    val type: String = "set_config_option",
    val configId: String,
    val value: JsonElement,
    val valueType: String? = null,
)

// ── UI State models ──

sealed class ChatItem {
    data class UserMessage(val text: String, val id: String = java.util.UUID.randomUUID().toString()) : ChatItem()
    data class AgentMessage(val text: String, val id: String = java.util.UUID.randomUUID().toString()) : ChatItem()
    data class ThoughtMessage(val text: String, val id: String = java.util.UUID.randomUUID().toString()) : ChatItem()
    data class ToolCall(
        val toolCallId: String,
        val title: String = "",
        val kind: String = "other",
        val status: String = "pending",
        val contentText: String = "",
        val locations: List<ToolLocation> = emptyList(),
    ) : ChatItem()
    data class PlanView(val entries: List<PlanEntry>, val id: String = java.util.UUID.randomUUID().toString()) : ChatItem()
    data class Status(val text: String, val id: String = java.util.UUID.randomUUID().toString()) : ChatItem()
    data class Error(val text: String, val id: String = java.util.UUID.randomUUID().toString()) : ChatItem()
    data class Done(val stopReason: String, val id: String = java.util.UUID.randomUUID().toString()) : ChatItem()
}

data class ConnectionState(
    val connected: Boolean = false,
    val sessionId: String? = null,
)

data class ActivePermission(
    val requestId: String,
    val title: String,
    val toolCall: ToolCallDetail? = null,
    val options: List<PermissionOption>,
)

@Serializable
data class UsageInfo(
    val contextSize: Int? = null,
    val inputTokens: Int? = null,
    val outputTokens: Int? = null,
    val totalCost: String? = null,
    val percentRemaining: Int? = null,
    val premiumRequestsUsed: Int? = null,
    val premiumRequestsLimit: Int? = null,
)

// ── Authentication models ──

@Serializable
data class AuthStatus(
    val status: String, // "setup", "login", "authenticated"
    val username: String? = null,
)

@Serializable
data class AuthRequest(
    val username: String,
    val password: String,
)

@Serializable
data class AuthResponse(
    val token: String,
    val username: String,
)

@Serializable
data class ErrorResponse(
    val error: String,
)
