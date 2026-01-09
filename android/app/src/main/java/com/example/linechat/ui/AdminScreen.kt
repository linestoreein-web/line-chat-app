package com.example.linechat.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.linechat.data.ChatRepository
import kotlinx.coroutines.launch

@Composable
fun AdminScreen(
    repository: ChatRepository,
    onNavigateBack: () -> Unit
) {
    var userCount by remember { mutableStateOf("Loading...") }
    var generatedKey by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            val stats = repository.getStats()
            userCount = stats.userCount.toString()
        } catch (e: Exception) {
            userCount = "Error"
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Admin Dashboard", style = MaterialTheme.typography.headlineMedium)
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Card(modifier = Modifier.fillMaxWidth().padding(8.dp)) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Total Users", style = MaterialTheme.typography.titleMedium)
                Text(userCount, style = MaterialTheme.typography.displayMedium)
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Button(
            onClick = {
                scope.launch {
                    try {
                        val key = repository.generateKey()
                        generatedKey = key
                    } catch (e: Exception) {
                        generatedKey = "Error"
                    }
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Generate Invite Key")
        }
        
        generatedKey?.let {
            Spacer(modifier = Modifier.height(16.dp))
            Text("New Key:", style = MaterialTheme.typography.bodyLarge)
            Text(it, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        OutlinedButton(onClick = onNavigateBack) {
            Text("Go to Chat")
        }
    }
}
