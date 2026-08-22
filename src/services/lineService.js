/**
 * LINE Messaging API Service
 * Handles Reply and Push messages using native HTTP requests.
 */

const channelAccessToken = () => process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

/**
 * Reply message to LINE user/group
 */
async function replyMessage(replyToken, messages) {
  const token = channelAccessToken();
  if (!token) {
    console.warn('⚠️ LINE_CHANNEL_ACCESS_TOKEN is not configured in .env');
    return;
  }

  const payloadMessages = Array.isArray(messages) ? messages : [messages];

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: payloadMessages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ LINE Reply API Error:', response.status, errorText);
    }
  } catch (error) {
    console.error('❌ Error sending LINE Reply:', error.message);
  }
}

/**
 * Push message to LINE user/group
 */
async function pushMessage(to, messages) {
  const token = channelAccessToken();
  if (!token) {
    console.warn('⚠️ LINE_CHANNEL_ACCESS_TOKEN is not configured in .env');
    return;
  }

  const payloadMessages = Array.isArray(messages) ? messages : [messages];

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        to: to,
        messages: payloadMessages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ LINE Push API Error:', response.status, errorText);
    }
  } catch (error) {
    console.error('❌ Error sending LINE Push:', error.message);
  }
}

module.exports = {
  replyMessage,
  pushMessage
};
