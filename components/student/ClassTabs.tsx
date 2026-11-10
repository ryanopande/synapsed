"use client";

import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

interface ClassTabsProps {
  classId: string;
}

export function ClassTabs({ classId }: ClassTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Determine active tab based on pathname
  const activeTab = pathname?.includes('/quizzes') ? 'quizzes' : 'pathway';

  const handleTabChange = (value: string) => {
    if (value === 'pathway') {
      router.push(`/class/${classId}/pathway`);
    } else if (value === 'quizzes') {
      router.push(`/class/${classId}/quizzes`);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="pathway" asChild>
          <Link href={`/class/${classId}/pathway`}>Pathway</Link>
        </TabsTrigger>
        <TabsTrigger value="quizzes" asChild>
          <Link href={`/class/${classId}/quizzes`}>Quizzes</Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

