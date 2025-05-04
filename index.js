const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Slack-Telegram Relay Service is running');
});

app.get('/relay', async (req, res) => {
  try {
    // Get URL and token from query parameters
    const { url, token } = req.query;
    
    if (!url || !token) {
      return res.status(400).send('Missing URL or token');
    }
    
    console.log(`Relaying file: ${url}`);
    
    // Download file from Slack
    const fileResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!fileResponse.ok) {
      console.error(`Slack error: ${fileResponse.status} ${fileResponse.statusText}`);
      return res.status(fileResponse.status).send(`Failed to download from Slack: ${fileResponse.statusText}`);
    }
    
    // Get content type and set appropriate headers
    const contentType = fileResponse.headers.get('content-type');
    res.setHeader('Content-Type', contentType);
    
    // Get content length if available
    const contentLength = fileResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    // Set cache control headers to help Telegram cache the file
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    // Pipe the file directly to the response
    fileResponse.body.pipe(res);
    
    console.log('File relay initiated');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
});

// New endpoint specifically for Telegram
app.get('/telegram', async (req, res) => {
  try {
    // Get parameters
    const { url, token, botToken, chatId, topicId, caption, method } = req.query;
    
    if (!url || !token || !botToken || !chatId) {
      return res.status(400).send('Missing required parameters');
    }
    
    console.log(`Processing Telegram request for: ${url}`);
    
    // Download file from Slack
    const fileResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!fileResponse.ok) {
      return res.status(fileResponse.status).send(`Failed to download from Slack: ${fileResponse.statusText}`);
    }
    
    // Get file as buffer
    const buffer = await fileResponse.buffer();
    
    // Create form data for Telegram
    const FormData = require('form-data');
    const form = new FormData();
    
    // Add chat_id and caption
    form.append('chat_id', chatId);
    if (topicId) {
      form.append('message_thread_id', topicId);
    }
    if (caption) {
      form.append('caption', caption);
    }
    
    // Determine file parameter name based on method
    const fileParam = method === 'sendPhoto' ? 'photo' : 
                     method === 'sendVideo' ? 'video' : 
                     method === 'sendAudio' ? 'audio' : 'document';
    
    // Add file to form
    const fileName = url.split('/').pop() || 'file';
    form.append(fileParam, buffer, { filename: fileName });
    
    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${botToken}/${method || 'sendDocument'}`;
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      body: form
    });
    
    const result = await telegramResponse.json();
    res.json(result);
    
    console.log('Telegram request processed');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
