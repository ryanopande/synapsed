import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const { nodeId, cardId, mastered } = await request.json();
    
    if (!nodeId || !cardId) {
      return NextResponse.json({ error: 'nodeId and cardId are required' }, { status: 400 });
    }
    
    const progress = await prisma.nodeProgress.upsert({
      where: {
        nodeId_studentId: {
          nodeId,
          studentId: user.id
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
        studentId: user.id,
        flashMasteredIds: mastered ? [cardId] : []
      }
    });
    
    return NextResponse.json(progress);
  } catch (error) {
    console.error('Failed to update progress:', String(error));
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
} 