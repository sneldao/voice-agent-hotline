/**
 * Seed Demo Agents
 * Run: npx tsx scripts/seed-agents.ts
 */

const agents = [
  {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Dr. Sarah Chen',
    description: 'Licensed therapist specializing in anxiety and stress management. Warm, empathetic, and evidence-based approaches.',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',  // Sarah
    capabilities: ['therapy', 'mental-health', 'support'],
    ratePerMinute: 2.50
  },
  {
    address: '0x2345678901234567890123456789012345678901',
    name: 'Chef Mario',
    description: 'Italian cuisine expert. Can guide you through recipes, suggest wine pairings, and teach cooking techniques.',
    voiceId: '21m00Tcm4TlvDq8ikWAM',  // Rachel
    capabilities: ['cooking', 'recipes', 'wine'],
    ratePerMinute: 1.00
  },
  {
    address: '0x3456789012345678901234567890123456789012',
    name: 'CodeWizard',
    description: 'Full-stack developer specializing in React, TypeScript, and Node.js. Debug, architect, and learn.',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',  // George
    capabilities: ['coding', 'react', 'typescript', 'debugging'],
    ratePerMinute: 3.00
  },
  {
    address: '0x4567890123456789012345678901234567890123',
    name: 'Legal Eagle',
    description: 'Contract law specialist. Help with agreements, terms of service, and legal document review.',
    voiceId: 'AZnzlk1XvdvUe5bTIl8b',  // Domi
    capabilities: ['legal', 'contracts', 'compliance'],
    ratePerMinute: 5.00
  },
  {
    address: '0x5678901234567890123456789012345678901234',
    name: 'FitCoach',
    description: 'Personal fitness coach. Workouts, nutrition advice, and motivation for your health journey.',
    voiceId: 'MF3mGyEYrkw8f8mmU3L0',  // Adam
    capabilities: ['fitness', 'nutrition', 'wellness'],
    ratePerMinute: 1.50
  }
]

console.log('Demo agents to seed:')
agents.forEach(a => {
  console.log(`  - ${a.name} (${a.capabilities.join(', ')}) - $${a.ratePerMinute}/min`)
})
console.log('\nRun this in your API route to seed the database.')
