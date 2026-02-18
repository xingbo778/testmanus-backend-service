import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Database, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function RuleManager() {
  const { data: chapters, isLoading } = trpc.rule.chapters.useQuery();
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);

  const seedRules = trpc.rule.seed.useMutation({
    onSuccess: () => { toast.success("规则手册导入成功"); },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">规则手册</h1>
          <p className="text-muted-foreground mt-1">分镜设计终极规则手册，共25章1087条规则</p>
        </div>
        <Button
          variant="outline"
          onClick={() => seedRules.mutate()}
          disabled={seedRules.isPending}
        >
          {seedRules.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
          重新导入规则
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : chapters?.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chapters.map((ch: any) => (
            <Card
              key={ch.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedChapter === ch.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelectedChapter(selectedChapter === ch.id ? null : ch.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  {ch.chapterTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">第{ch.chapterNumber}章</Badge>
                  <Badge variant="secondary" className="text-xs">{ch.ruleCount ?? 0} 条规则</Badge>
                  {ch.applicableScenes && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {(typeof ch.applicableScenes === 'string'
                        ? ch.applicableScenes.split(',')
                        : Array.isArray(ch.applicableScenes) ? ch.applicableScenes : []
                      ).slice(0, 3).map((s: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs bg-muted/50">{s.trim()}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                {selectedChapter === ch.id && ch.content && (
                  <ScrollArea className="mt-3 max-h-60">
                    <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                      {typeof ch.content === 'string' ? ch.content : JSON.stringify(ch.content, null, 2)}
                    </pre>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-4">规则手册尚未导入</p>
            <Button onClick={() => seedRules.mutate()} disabled={seedRules.isPending}>
              {seedRules.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              导入规则手册
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
