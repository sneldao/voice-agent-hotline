import { NextRequest, NextResponse } from 'next/server';
import { handleOptions, withCors } from '@/lib/cors';
import { getUserByAddress, updateUserBalance, createUser } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    // Normalize and validate address
    const normalizedAddress = address.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedAddress)) {
      return withCors(NextResponse.json({ error: 'Invalid address' }, { status: 400 }), request);
    }

    let user = await getUserByAddress(normalizedAddress);

    if (!user) {
      // Auto-create user on first fetch — prevents 404 console noise
      // and ensures balance tracking works from first wallet connection
      const now = Date.now();
      user = await createUser({
        id: `user_${normalizedAddress}`,
        address: normalizedAddress,
        balance: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    return withCors(
      NextResponse.json({
        id: user.id,
        address: user.address,
        balance: user.balance,
        createdAt: user.createdAt,
      }),
      request
    );
  } catch (error) {
    console.error('Error fetching user:', error);
    return withCors(NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 }), request);
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
        return withCors(NextResponse.json({ success: true, balance: amount }), request);
        
      default:
        return withCors(NextResponse.json({ error: 'Invalid action' }, { status: 400 }), request);
    }
  } catch (error) {
    console.error('Error updating user:', error);
    return withCors(NextResponse.json({ error: 'Failed to update user' }, { status: 500 }), request);
  }
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}
