import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/api-auth';
import { seedAgents } from '@/lib/db-seed';

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdminAuth(req);
    if (auth) return auth;

    await seedAgents();
    
    return NextResponse.json({
      success: true,
      message: 'Brokers seeded successfully'
    });
  } catch (error) {
    console.error('Error seeding brokers:', error);
    return NextResponse.json(
      { error: 'Failed to seed brokers' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to seed brokers'
  });
}
