const express = require('express');
const fetch = require('node-fetch');
const FormData = require('form-data');
const app = express();
const PORT = process.env.PORT || 3000;

// Add middleware to parse JSON
app.use(express.json());

// Add detailed logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Query params:', req.query);
  next();
});

app.get('/', (req, res) => {
  res.send('Slack-Telegram Relay Service is running');
});

app.get('/relay', async (req, res) => {
  try {
    // Get URL and token from query parameters
    const { url, token } = req.query;
    
    if (!url || !token) {
      console.error('Missing URL or token');
      return res.status(400).send('Missing URL or token');
    }
    
    console.log(`Relaying file: ${url}`);
    
    // Download file from Slack
    console.log('Downloading from Slack...');
    const fileResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!fileResponse.ok) {
      console.error(`Slack error: ${fileResponse.status} ${fileResponse.statusText}`);
      return res.status(fileResponse.status).send(`Failed to download from Slack: ${fileResponse.statusText}`);
    }
    
    console.log('File downloaded successfully');
    console.log('Content-Type:', fileResponse.headers.get('content-type'));
    console.log('Content-Length:', fileResponse.headers.get('content-length'));
    
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
    console.log('Piping file to response...');
    fileResponse.body.pipe(res);
    
    console.log('File relay initiated');
  } catch (error) {
    console.error('Error in /relay:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
});

// New endpoint specifically for Telegram
app.get('/telegram', async (req, res) => {
  try {
    console.log('Telegram endpoint called');
    
    // Get parameters
    const { url, token, botToken, chatId, topicId, caption, method } = req.query;
    
    if (!url || !token || !botToken || !chatId) {
      console.error('Missing required parameters');
      return res.status(400).send('Missing required parameters');
    }
    
    console.log(`Processing Telegram request for: ${url}`);
    console.log('Method:', method);
    console.log('Chat ID:', chatId);
    
    // Download file from Slack
    console.log('Downloading file from Slack...');
    const fileResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!fileResponse.ok) {
      console.error(`Slack download error: ${fileResponse.status} ${fileResponse.statusText}`);
      return res.status(fileResponse.status).send(`Failed to download from Slack: ${fileResponse.statusText}`);
    }
    
    console.log('File downloaded successfully');
    
    // Get file as buffer
    console.log('Converting to buffer...');
    const buffer = await fileResponse.buffer();
    console.log('Buffer size:', buffer.length);
    
    // Create form data for Telegram
    console.log('Creating form data...');
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
    console.log('Adding file to form with param:', fileParam);
    form.append(fileParam, buffer, { filename: fileName });
    
    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${botToken}/${method || 'sendDocument'}`;
    console.log('Sending to Telegram:', telegramUrl);
    
    const telegramResponse = await fetch(telegramUrl, {
      method: 'POST',
      body: form
    });
    
    console.log('Telegram response status:', telegramResponse.status);
    const result = await telegramResponse.json();
    console.log('Telegram response:', JSON.stringify(result));
    
    res.json(result);
    
    console.log('Telegram request processed');
  } catch (error) {
    console.error('Error in /telegram:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
});

// Add a test endpoint
app.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Relay service is working',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/test`);
});
