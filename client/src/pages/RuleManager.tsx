import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Database, Loader2, ArrowLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  universal: "通用规则",
  scene_specific: "场景规则",
  technical: "技术规则",
  ai_prompt: "AI提示规则",
};

const CATEGORY_COLORS: Record<string, string> = {
  universal: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  scene_specific: "bg-green-500/10 text-green-500 border-green-500/20",
  technical: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  ai_prompt: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

const SEVERITY_ICONS: Record<string, typeof CheckCircle> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-500",
  warning: "text-yellow-500",
  info: "text-blue-400",
};

export default function RuleManager() {
  const { data: chapters, isLoading } = trpc.rule.chapters.useQuery();
  const [selectedChapterNumber, setSelectedChapterNumber] = useState<number | null>(null);

  const seedRules = trpc.rule.seed.useMutation({
    onSuccess: () => { toast.success("规则手册导入成功"); },
    onError: (err: any) => toast.error(err.message),
  });

  // Query for chapter detail
  const chapterDetail = trpc.rule.chapterDetail.useQuery(
    { chapterNumber: selectedChapterNumber! },
    { enabled: selectedChapterNumber !== null }
  );

  // Parse rules from chapter detail
  const rules = (() => {
    if (!chapterDetail.data?.rules) return [];
    try {
      const raw = typeof chapterDetail.data.rules === "string"
        ? JSON.parse(chapterDetail.data.rules as string)
        : chapterDetail.data.rules;
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  })();

  // Group chapters by category
  const groupedChapters = (() => {
    if (!chapters) return {};
    const groups: Record<string, typeof chapters> = {};
    for (const ch of chapters) {
      const cat = ch.category || "universal";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ch);
    }
    return groups;
  })();

  const totalRules = chapters?.reduce((sum: number, ch: any) => sum + (ch.ruleCount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">规则手册</h1>
          <p className="text-muted-foreground mt-1">
            分镜设计终极规则手册，共{chapters?.length || 25}章{totalRules}条规则
          </p>
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

      {/* Summary Stats */}
      {chapters && chapters.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const count = groupedChapters[key]?.length || 0;
            const ruleCount = groupedChapters[key]?.reduce((sum: number, ch: any) => sum + (ch.ruleCount || 0), 0) || 0;
            return (
              <Card key={key} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[key]}`}>{label}</Badge>
                </div>
                <p className="text-lg font-bold">{count} <span className="text-sm font-normal text-muted-foreground">章</span></p>
                <p className="text-xs text-muted-foreground">{ruleCount} 条规则</p>
              </Card>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : chapters?.length ? (
        <div className="space-y-6">
          {Object.entries(groupedChapters).map(([category, chapterList]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline" className={`${CATEGORY_COLORS[category]}`}>
                  {CATEGORY_LABELS[category] || category}
                </Badge>
                <span className="text-sm text-muted-foreground font-normal">{chapterList.length}章</span>
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {chapterList.map((ch: any) => (
                  <Card
                    key={ch.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
                    onClick={() => setSelectedChapterNumber(ch.chapterNumber)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="line-clamp-1">第{ch.chapterNumber}章 · {ch.title}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{ch.ruleCount ?? 0} 条规则</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
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

      {/* Chapter Detail Dialog */}
      <Dialog open={selectedChapterNumber !== null} onOpenChange={(open) => !open && setSelectedChapterNumber(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              第{selectedChapterNumber}章 · {chapterDetail.data?.title || "加载中..."}
            </DialogTitle>
            <DialogDescription>
              {chapterDetail.data && (
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[chapterDetail.data.category]}`}>
                    {CATEGORY_LABELS[chapterDetail.data.category] || chapterDetail.data.category}
                  </Badge>
                  <span>{chapterDetail.data.ruleCount} 条规则</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {chapterDetail.isLoading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : rules.length > 0 ? (
              <div className="space-y-2 py-2">
                {rules.map((rule: any, idx: number) => {
                  const SeverityIcon = SEVERITY_ICONS[rule.severity] || Info;
                  const severityColor = SEVERITY_COLORS[rule.severity] || "text-muted-foreground";
                  const isDoRule = rule.type === "do";

                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        isDoRule ? "bg-green-500/5 border-green-500/10" : "bg-red-500/5 border-red-500/10"
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {isDoRule ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-[10px] ${isDoRule ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}`}>
                            {isDoRule ? "DO" : "DON'T"}
                          </Badge>
                          <SeverityIcon className={`h-3 w-3 ${severityColor}`} />
                          <span className={`text-[10px] ${severityColor}`}>{rule.severity || "info"}</span>
                        </div>
                        <p className="text-sm leading-relaxed">{rule.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">暂无规则数据</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
