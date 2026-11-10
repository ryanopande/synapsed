import { prisma } from '@/lib/prisma';
import { MessageRole, Prisma } from '@prisma/client';
import type { SourceMetadata } from './simple-agent';

interface ConversationParams {
  userId: string;
  classId?: string;
  lessonId?: string;
  threadId?: string;
  title?: string;
}

interface SaveMessageParams {
  conversationId: string;
  role: MessageRole;
  content: string;
  sources?: SourceMetadata[];
}

/**
 * Service layer for managing conversations and messages
 */
export class ConversationService {
  /**
   * Get or create a conversation for a specific user, class, and lesson combination
   * This ensures one continuous conversation per userId + classId + lessonId
   */
  static async getOrCreateConversation(params: ConversationParams) {
    const { userId, classId, lessonId, threadId, title } = params;

    // Try to find existing conversation
    const existing = await prisma.conversation.findFirst({
      where: {
        userId,
        classId: classId || null,
        lessonId: lessonId || null,
      },
      include: {
        messages: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Create new conversation if none exists
    // Generate threadId if not provided (should match agent memory thread)
    const newThreadId = threadId || `thread_${userId}_${classId || 'global'}_${lessonId || 'general'}_${Date.now()}`;

    const newConversation = await prisma.conversation.create({
      data: {
        threadId: newThreadId,
        userId,
        classId: classId || null,
        lessonId: lessonId || null,
        title: title || null,
      },
      include: {
        messages: true,
      },
    });

    return newConversation;
  }

  /**
   * Get conversation by userId, classId, and lessonId
   */
  static async getConversationByLesson(
    userId: string,
    classId?: string,
    lessonId?: string
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        userId,
        classId: classId || null,
        lessonId: lessonId || null,
      },
      include: {
        messages: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    return conversation;
  }

  /**
   * Get conversation by threadId
   */
  static async getConversationByThreadId(threadId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: {
        threadId,
      },
      include: {
        messages: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    return conversation;
  }

  /**
   * Save a message to a conversation
   */
  static async saveMessage(params: SaveMessageParams) {
    const { conversationId, role, content, sources } = params;

    // Ensure sources is properly formatted for Prisma JSON field
    let sourcesJson: Prisma.InputJsonValue | null = null;
    if (sources && Array.isArray(sources) && sources.length > 0) {
      // Prisma JSON fields expect plain objects/arrays, ensure it's serializable
      try {
        // Validate sources structure
        sourcesJson = sources.map(source => ({
          title: source.title || '',
          page: source.page || null,
          materialId: source.materialId || null,
          classId: source.classId || null,
        })) as Prisma.InputJsonValue;
      } catch (e) {
        console.error('[ConversationService] Error formatting sources:', e);
        sourcesJson = null;
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        sources: sourcesJson,
      },
    });

    // Update conversation's updatedAt timestamp
    await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return message;
  }

  /**
   * Get all messages for a conversation
   */
  static async getConversationMessages(conversationId: string) {
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    return messages;
  }

  /**
   * Get all conversations for a user
   */
  static async getUserConversations(userId: string, limit: number = 20) {
    const conversations = await prisma.conversation.findMany({
      where: {
        userId,
      },
      include: {
        messages: {
          orderBy: {
            timestamp: 'desc',
          },
          take: 1, // Just get the last message for preview
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });

    return conversations;
  }

  /**
   * Save/create a conversation (for backwards compatibility with existing API)
   * Note: This method will create or update a conversation. For new conversations,
   * prefer using getOrCreateConversation which handles uniqueness checks.
   */
  static async saveConversation(params: {
    threadId: string;
    userId: string;
    classId?: string;
    lessonId?: string;
    title?: string;
    messages?: unknown[];
  }) {
    // Check if conversation with this threadId already exists
    const existing = await prisma.conversation.findUnique({
      where: {
        threadId: params.threadId,
      },
    });

    if (existing) {
      // Update existing conversation
      return prisma.conversation.update({
        where: {
          id: existing.id,
        },
        data: {
          title: params.title || existing.title,
          updatedAt: new Date(),
        },
        include: {
          messages: true,
        },
      });
    }

    // Create new conversation
    return prisma.conversation.create({
      data: {
        threadId: params.threadId,
        userId: params.userId,
        classId: params.classId || null,
        lessonId: params.lessonId || null,
        title: params.title || null,
      },
      include: {
        messages: true,
      },
    });
  }
}

