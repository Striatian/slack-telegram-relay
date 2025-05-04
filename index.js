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
    
    // Get content type
    const contentType = fileResponse.headers.get('content-type');
    res.setHeader('Content-Type', contentType);
    
    // Pipe the file directly to the response
    fileResponse.body.pipe(res);
    
    console.log('File relayed successfully');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(`Server error: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
