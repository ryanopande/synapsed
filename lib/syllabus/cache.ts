import { prisma } from '@/lib/prisma';
import { Content } from '@/lib/types/content';

export interface CacheEntry {
  materialId: string;
  content:  Content;
  processedAt: Date;
  confidence: number;
  version: string;
}

/**
 * Intelligent caching system for syllabus processing
 */
export class SyllabusCache {
  private static readonly CACHE_VERSION = '1.0';
  private static readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  /**
   * Get cached content for a material
   */
  static async get(materialId: string): Promise<CacheEntry | null> {
    try {
      const material = await prisma.classMaterial.findUnique({
        where: { id: materialId },
        select: {
          id: true,
          extractedText: true,
          learningObjectives: true,
          courseSchedule: true,
          syllabusProcessed: true,
          processedAt: true,
          uploadedAt: true,
        },
      });

      if (!material || !material.syllabusProcessed || !material.processedAt) {
        return null;
      }

      // Check if cache is still valid
      const cacheAge = Date.now() - material.processedAt.getTime();
      if (cacheAge > this.CACHE_TTL) {
        console.log(`🕐 Cache expired for material ${materialId}`);
        return null;
      }

      return {
        materialId: material.id,
        content: {
          extractedText: material.extractedText,
          learningObjectives: material.learningObjectives,
          courseSchedule: material.courseSchedule,
        },
        processedAt: material.processedAt,
        confidence: 85, // Default confidence for cached content
        version: this.CACHE_VERSION,
      };
    } catch (error) {
      console.error('Cache retrieval failed:', error);
      return null;
    }
  }

  /**
   * Store processed content in cache
   */
  static async set(materialId: string, content: CacheEntry['content'], confidence: number): Promise<void> {
    // console.log('🔍 Cache.set called with:', {
    //   materialId,
    //   hasContent: !!content,
    //   contentType: typeof content,
    //   contentKeys: content ? Object.keys(content) : 'null',
    //   confidence
    // });
    
    try {
      // Debug each field to find the null value
      // console.log('🔍 Content field values:', {
      //   extractedText: content.extractedText,
      //   learningObjectives: content.learningObjectives?.substring(0, 50) + '...',
      //   courseSchedule: content.courseSchedule?.substring(0, 50) + '...',
      //   assessmentMethods: content.assessmentMethods,
      //   prerequisites: content.prerequisites?.substring(0, 50) + '...',
      //   courseDescription: content.courseDescription?.substring(0, 50) + '...',
      //   instructorInfo: content.instructorInfo?.substring(0, 50) + '...',
      //   gradingPolicy: content.gradingPolicy?.substring(0, 50) + '...',
      // });
      
      await prisma.classMaterial.update({
        where: { id: materialId },
        data: {
          extractedText: content.extractedText,
          learningObjectives: content.learningObjectives,
          courseSchedule: content.courseSchedule,
          assessmentMethods: content.assessmentMethods,
          prerequisites: content.prerequisites,
          courseDescription: content.courseDescription,
          instructorInfo: content.instructorInfo,
          gradingPolicy: content.gradingPolicy,
          syllabusProcessed: true,
          processedAt: new Date(),
        },
      });
      console.log(`💾 Cached content for material ${materialId} with confidence ${confidence}%`);
    } catch (error) {
      console.error('Cache storage failed:', error);
      throw error;
    }
  }

  /**
   * Check if material needs reprocessing
   */
  static async needsReprocessing(materialId: string): Promise<boolean> {
    try {
      const material = await prisma.classMaterial.findUnique({
        where: { id: materialId },
        select: {
          syllabusProcessed: true,
          processedAt: true,
          uploadedAt: true,
        },
      });

      if (!material) return true;
      if (!material.syllabusProcessed) return true;
      if (!material.processedAt) return true;

      // Check if file was updated after processing
      if (material.uploadedAt > material.processedAt) {
        console.log(`🔄 Material ${materialId} was updated after processing`);
        return true;
      }

      // Check cache age
      const cacheAge = Date.now() - material.processedAt.getTime();
      if (cacheAge > this.CACHE_TTL) {
        console.log(`🕐 Cache expired for material ${materialId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Cache check failed:', error);
      return true; // Reprocess on error
    }
  }

  /**
   * Invalidate cache for a material
   */
  static async invalidate(materialId: string): Promise<void> {
    try {
      await prisma.classMaterial.update({
        where: { id: materialId },
        data: {
          syllabusProcessed: false,
          processedAt: null,
          extractedText: null,
          learningObjectives: null,
          courseSchedule: null,
        },
      });
      console.log(`🗑️ Invalidated cache for material ${materialId}`);
    } catch (error) {
      console.error('Cache invalidation failed:', error);
    }
  }

  /**
   * Get processing statistics
   */
  static async getStats(classId?: string): Promise<{
    total: number;
    processed: number;
    pending: number;
    averageConfidence: number;
  }> {
    try {
      const where = classId ? { classId, category: 'SYLLABUS' as const } : { category: 'SYLLABUS' as const };
      
      const [total, processed] = await Promise.all([
        prisma.classMaterial.count({ where }),
        prisma.classMaterial.count({ 
          where: { ...where, syllabusProcessed: true } 
        }),
      ]);

      return {
        total,
        processed,
        pending: total - processed,
        averageConfidence: 85, // Could be calculated from actual confidence scores
      };
    } catch (error) {
      console.error('Stats retrieval failed:', error);
      return { total: 0, processed: 0, pending: 0, averageConfidence: 0 };
    }
  }
}
