import { invokeAgent } from './lib/agent/simple-agent.js';

async function testAgent() {
  console.log('Testing Synapsed Agent...\n');

  // Test 1: Simple message
  console.log('Test 1: Simple greeting');
  const response1 = await invokeAgent('Hello! What can you help me with?');
  console.log('Response:', response1);
  console.log('\n');

  // Test 2: Tool usage - student progress
  console.log('Test 2: Get student progress');
  const response2 = await invokeAgent('What is the progress of student123 in class456?');
  console.log('Response:', response2);
  console.log('\n');

  // Test 3: Tool usage - class resources
  console.log('Test 3: Get class resources');
  const response3 = await invokeAgent('What resources are available for class789?');
  console.log('Response:', response3);
  console.log('\n');

  // Test 4: Tool usage - flashcards
  console.log('Test 4: Generate flashcards');
  const response4 = await invokeAgent('Can you generate flashcards for "Photosynthesis"?');
  console.log('Response:', response4);
  console.log('\n');

  console.log('All tests completed!');
}

testAgent().catch(console.error);
