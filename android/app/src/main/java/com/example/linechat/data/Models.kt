package com.example.linechat.data

import com.google.gson.annotations.SerializedName

data class RegisterRequest(
    val key: String,
    val username: String,
    val password: String
)

data class RegisterResponse(
    val success: Boolean,
    val userId: Int
)

data class SendMessageRequest(
    val sender_id: Int,
    val receiver_id: Int,
    val text_content: String?,
    val media_id_ref: Int?
)

data class Message(
    val id: Int,
    val sender_id: Int,
    val receiver_id: Int,
    val text_content: String?,
    val media_id_ref: Int?,
    val timestamp: Long
)

data class AdminStats(
    val userCount: Int
)

data class GenerateKeyResponse(
    val key: String
)

data class UploadResponse(
    val mediaId: Int
)
