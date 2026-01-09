package com.example.linechat.data

import android.content.Context
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ChatRepository(private val context: Context) {

    private val api: ApiService

    init {
        // Localhost for Android Emulator is 10.0.2.2
        val retrofit = Retrofit.Builder()
            .baseUrl("http://10.0.2.2:8787/") 
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        api = retrofit.create(ApiService::class.java)
    }

    suspend fun register(key: String, username: String, pass: String) = api.register(RegisterRequest(key, username, pass))

    suspend fun sendMessage(senderId: Int, receiverId: Int, text: String?, mediaId: Int?) {
        api.sendMessage(SendMessageRequest(senderId, receiverId, text, mediaId))
    }

    suspend fun syncMessages(userId: Int, after: Long) = api.syncMessages(userId, after)

    suspend fun generateKey(): String? {
        val response = api.generateKey()
        return if (response.isSuccessful) response.body()?.key else null
    }

    suspend fun getStats(): AdminStats {
        val response = api.getStats()
        return if (response.isSuccessful) response.body()!! else AdminStats(0)
    }

    suspend fun uploadImage(bytes: ByteArray): Int? {
        val reqBody = bytes.toRequestBody("image/jpeg".toMediaTypeOrNull())
        val response = api.uploadMedia(reqBody)
        return if (response.isSuccessful) response.body()?.mediaId else null
    }

    suspend fun downloadAndSaveImage(mediaId: String): File? {
        // check if exists locally first
        val file = File(context.filesDir, "media_$mediaId.jpg")
        if (file.exists()) return file

        val response = api.downloadMedia(mediaId)
        if (response.isSuccessful && response.body() != null) {
            return saveFileToInternalStorage(response.body()!!.byteStream(), "media_$mediaId.jpg")
        }
        return null
    }

    // "The Bridge Method": Save stream to local storage
    private suspend fun saveFileToInternalStorage(inputStream: InputStream, fileName: String): File? {
        return withContext(Dispatchers.IO) {
            try {
                val file = File(context.filesDir, fileName)
                val outputStream = FileOutputStream(file)
                inputStream.use { input ->
                    outputStream.use { output ->
                        input.copyTo(output)
                    }
                }
                file
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }
}
