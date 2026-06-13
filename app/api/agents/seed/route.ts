import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-auth';
import { seedAgents } from '@/lib/db-seed';

export async function POST(req: NextRequest) {
  try {
    if (!verifyApiKey(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await seedAgents();
    
    return NextResponse.json({
      success: true,
      message: 'Agents seeded successfully'
    });
  } catch (error) {
    console.error('Error seeding agents:', error);
    return NextResponse.json(
      { error: 'Failed to seed agents' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to seed agents'
  });
}
