import { NextResponse } from 'next/server';
import { seedAgents } from '@/lib/db-seed';

export async function POST() {
  try {
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
