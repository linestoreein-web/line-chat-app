package com.example.linechat.data

import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

interface ApiService {
    @POST("/register")
    suspend fun register(@Body request: RegisterRequest): Response<RegisterResponse>

    @POST("/upload")
    suspend fun uploadMedia(@Body file: RequestBody): Response<UploadResponse>

    @GET("/media/{id}")
    @Streaming
    suspend fun downloadMedia(@Path("id") id: String): Response<ResponseBody>

    @POST("/send")
    suspend fun sendMessage(@Body request: SendMessageRequest): Response<Void>

    @GET("/sync")
    suspend fun syncMessages(@Query("userId") userId: Int, @Query("after") timestamp: Long): List<Message>

    @POST("/admin/generate-key")
    suspend fun generateKey(): Response<GenerateKeyResponse>

    @GET("/admin/stats")
    suspend fun getStats(): Response<AdminStats>
}
