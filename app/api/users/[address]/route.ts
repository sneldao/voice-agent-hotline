import { NextRequest, NextResponse } from 'next/server';
import { getUserByAddress, updateUserBalance, createUser } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    // Normalize address
    const normalizedAddress = address.toLowerCase();
    
    let user = await getUserByAddress(normalizedAddress);
    
    if (!user) {
      // Return 404 instead of auto-creating to prevent phantom users from bots/prefetchers
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      id: user.id,
      address: user.address,
      balance: user.balance,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const body = await request.json();
    const { action, amount } = body;
    
    const normalizedAddress = address.toLowerCase();
    
    switch (action) {
      case 'add_balance':
        await updateUserBalance(`user_${normalizedAddress}`, amount);
        return NextResponse.json({ success: true, balance: amount });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
