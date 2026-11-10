"use client";

import { useState } from "react";
import useSWR from "swr";
import { File, MoreHorizontal, BookOpen, GraduationCap, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import TableSkeleton from "@/components/ui/table-skeleton";

interface Material {
  id: string;
  title: string;
  type: string;
  category: string;
  url: string;
  uploadedAt: string;
  isVectorized: boolean;
}

export function ContentView({ classId }: { classId: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [, setFileToRename] = useState<Material | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<Material | null>(null);

  // Fetcher for materials
  const materialsFetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch materials');
    return res.json();
  };

  // Use SWR for materials (cached and fast)
  const { data: materials = [], isLoading: loading } = useSWR<Material[]>(
    classId ? `/api/class/${classId}/materials` : null,
    materialsFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  const filteredFiles = materials.filter((file) =>
    file.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMaterialsByCategory = (category: string) => {
    return filteredFiles.filter((file) => file.category === category);
  };


  const handleRenameFile = () => {
    toast(
      "Rename not implemented",
      {description: "You can implement rename logic here.",}
    );
    setIsRenameDialogOpen(false);
  };

  const handleDeleteFile = () => {
    toast(
      "Delete not implemented",{
        description: "You can implement delete logic here.",
      }
     );
    setIsDeleteDialogOpen(false);
  };

  const getFileTypeBadge = (type: string, isVectorized: boolean) => {
    return (
      <Badge variant={isVectorized ? "default" : "secondary"}>
        {type.toUpperCase()} {isVectorized ? "✅" : "⏳"}
      </Badge>
    );
  };

  const renderMaterialsTable = (materials: Material[]) => {
    if (materials.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No files found in this category.
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="hidden md:table-cell">Upload Date</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((file) => (
            <TableRow key={file.id}>
              <TableCell className="font-medium">
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                  <File className="h-4 w-4" />
                  {file.title}
                </a>
              </TableCell>
              <TableCell>{getFileTypeBadge(file.type, file.isVectorized)}</TableCell>
              <TableCell className="hidden md:table-cell">
                {new Date(file.uploadedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setFileToRename(file);
                        setNewFileName(file.title);
                        setIsRenameDialogOpen(true);
                      }}
                    >
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        setFileToDelete(file);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Content Management</h2>
        <p className="text-muted-foreground">Manage your uploaded class materials organized by category.</p>
      </div>

      <Card className="hover:shadow-none hover:translate-y-0">
        <CardHeader>
          <CardTitle>Content Files</CardTitle>
          <CardDescription>Review and manage your uploaded materials by category.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
          
          <Tabs defaultValue="CONTENT" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="CONTENT" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Class Content ({getMaterialsByCategory("CONTENT").length})
              </TabsTrigger>
              <TabsTrigger value="SYLLABUS" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Syllabus ({getMaterialsByCategory("SYLLABUS").length})
              </TabsTrigger>
              <TabsTrigger value="EXERCISES" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Exercises ({getMaterialsByCategory("EXERCISES").length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="CONTENT" className="mt-4">
              <div className="rounded-md border">
                {loading ? (
                  <TableSkeleton columns={4} rows={6} />
                ) : (
                  renderMaterialsTable(getMaterialsByCategory("CONTENT"))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="SYLLABUS" className="mt-4">
              <div className="rounded-md border">
                {loading ? (
                  <TableSkeleton columns={4} rows={6} />
                ) : (
                  renderMaterialsTable(getMaterialsByCategory("SYLLABUS"))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="EXERCISES" className="mt-4">
              <div className="rounded-md border">
                {loading ? (
                  <TableSkeleton columns={4} rows={6} />
                ) : (
                  renderMaterialsTable(getMaterialsByCategory("EXERCISES"))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>Enter a new name for the file.</DialogDescription>
          </DialogHeader>
          <Input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameFile}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {fileToDelete?.title}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFile}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
