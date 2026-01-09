package com.example.linechat.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.linechat.data.ChatRepository
import com.example.linechat.data.Message
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

@Composable
fun ChatScreen(
    repository: ChatRepository,
    currentUserId: Int
) {
    var messages by remember { mutableStateOf(listOf<Message>()) }
    var inputText by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Polling Simpler Logic
    LaunchedEffect(Unit) {
        while(true) {
            try {
                // Get messages after last known
                val lastTime = messages.lastOrNull()?.timestamp ?: 0L
                val newMsgs = repository.syncMessages(currentUserId, lastTime)
                if (newMsgs.isNotEmpty()) {
                    messages = messages + newMsgs
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
            delay(3000)
        }
    }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            scope.launch {
                // Simple stream read for demo - in real app handle properly
                val inputStream = context.contentResolver.openInputStream(it)
                val bytes = inputStream?.readBytes()
                inputStream?.close()
                if (bytes != null) {
                    val mediaIdId = repository.uploadImage(bytes)
                     if (mediaIdId != null) {
                         // Send message with media ref
                         repository.sendMessage(currentUserId, 0 /*Demo receiver*/, null, mediaIdId) // 0 as receiver placeholder
                     }
                }
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.weight(1f).padding(8.dp),
            reverseLayout = false
        ) {
            items(messages) { msg ->
                MessageBubble(msg, isMe = msg.sender_id == currentUserId, repository = repository)
            }
        }
        
        Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
             IconButton(onClick = { launcher.launch("image/*") }) {
                 Text("+")
             }
             OutlinedTextField(
                 value = inputText,
                 onValueChange = { inputText = it },
                 modifier = Modifier.weight(1f)
             )
             Button(onClick = {
                 val text = inputText
                 inputText = ""
                 scope.launch {
                     repository.sendMessage(currentUserId, 0, text, null)
                 }
             }) {
                 Text("Send")
             }
        }
    }
}

@Composable
fun MessageBubble(msg: Message, isMe: Boolean, repository: ChatRepository) {
    val align = if (isMe) Alignment.End else Alignment.Start
    val color = if (isMe) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.secondaryContainer
    
    Column(
        modifier = Modifier.fillMaxWidth().padding(4.dp),
        horizontalAlignment = align
    ) {
        Box(
            modifier = Modifier
                .background(color, shape = RoundedCornerShape(8.dp))
                .padding(8.dp)
        ) {
            Column {
                if (msg.text_content != null) {
                    Text(msg.text_content)
                }
                
                if (msg.media_id_ref != null) {
                    // Logic to load image locally
                    var localFile by remember { mutableStateOf<File?>(null) }
                    
                    LaunchedEffect(msg.media_id_ref) {
                         localFile = repository.downloadAndSaveImage(msg.media_id_ref.toString())
                    }
                    
                    if (localFile != null) {
                        AsyncImage(
                            model = localFile,
                            contentDescription = "Image",
                            modifier = Modifier.size(200.dp)
                        )
                    } else {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    }
                }
            }
        }
    }
}
