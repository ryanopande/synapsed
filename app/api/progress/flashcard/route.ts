import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { nodeId, cardId, mastered } = await request.json();
    
    if (!nodeId || !cardId) {
      return NextResponse.json({ error: 'nodeId and cardId are required' }, { status: 400 });
    }
    
    const progress = await prisma.nodeProgress.upsert({
      where: {
        nodeId_studentId: {
          nodeId,
          studentId: session.user.id
        }
      },
      update: {
        flashMasteredIds: mastered 
          ? {
              push: cardId
            }
          : undefined // For now, we only add cards, not remove them
      },
      create: {
        nodeId,
        studentId: session.user.id,
        flashMasteredIds: mastered ? [cardId] : []
      }
    });
    
    return NextResponse.json(progress);
  } catch (error) {
    console.error('Failed to update progress:', String(error));
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
} 