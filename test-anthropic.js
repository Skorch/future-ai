const { createAnthropic } = require('@ai-sdk/anthropic');
const { generateText } = require('ai');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testAnthropic() {
  console.log('Testing Anthropic API...');
  console.log('API Key present:', !!process.env.ANTHROPIC_API_KEY);
  console.log(
    'API Key starts with:',
    `${process.env.ANTHROPIC_API_KEY?.substring(0, 10)}...`,
  );

  try {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const { text } = await generateText({
      model: anthropic('claude-3-haiku-20240307'),
      prompt: 'Say "Hello, API is working!" in 5 words or less.',
    });

    console.log('✅ SUCCESS! Response:', text);
  } catch (error) {
    console.error('❌ ERROR:', {
      message: error.message,
      status: error.status,
      statusCode: error.statusCode,
      cause: error.cause?.message,
    });

    if (error.message?.includes('429') || error.status === 429) {
      console.error('\n⚠️  Rate limit error. This usually means:');
      console.error('1. Your API key has exceeded its usage limits');
      console.error('2. Check your usage at: https://console.anthropic.com/');
    }

    if (error.message?.includes('401') || error.status === 401) {
      console.error('\n⚠️  Authentication error. This usually means:');
      console.error('1. Your API key is invalid or expired');
      console.error('2. The API key is not properly set in .env.local');
    }
  }
}

testAnthropic();
