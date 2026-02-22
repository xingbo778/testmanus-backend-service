import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Sparkles, Film, Clock, Trash2, ArrowRight, Loader2, Lightbulb, BookTemplate } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "草稿", variant: "secondary" },
  generated: { label: "已生成", variant: "default" },
  editing: { label: "编辑中", variant: "outline" },
  finalized: { label: "已定稿", variant: "default" },
  archived: { label: "已归档", variant: "secondary" },
};

export default function ScreenplayList() {
  const [, navigate] = useLocation();
  const { data: screenplays, isLoading } = trpc.screenplay.list.useQuery({});
  const { data: templates } = trpc.screenplayTemplate.list.useQuery({});
  const generateMutation = trpc.screenplay.generate.useMutation();
  const deleteMutation = trpc.screenplay.delete.useMutation();
  const utils = trpc.useUtils();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [totalDuration, setTotalDuration] = useState("60");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!idea.trim()) {
      toast.error("请输入你的灵感");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateMutation.mutateAsync({
        idea: idea.trim(),
        templateId: selectedTemplateId ? parseInt(selectedTemplateId) : undefined,
        totalDuration: parseInt(totalDuration),
        additionalContext: additionalContext.trim() || undefined,
      });
      toast.success(`脚本「${result.screenplay.title}」生成成功！`);
      setDialogOpen(false);
      setIdea("");
      setSelectedTemplateId("");
      setAdditionalContext("");
      utils.screenplay.list.invalidate();
      navigate(`/screenplay/${result.screenplayId}`);
    } catch (error: any) {
      toast.error(`生成失败: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这个脚本吗？")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("脚本已删除");
      utils.screenplay.list.invalidate();
    } catch (error: any) {
      toast.error(`删除失败: ${error.message}`);
    }
  };

  // Group templates by category
  const templatesByCategory = (templates ?? []).reduce((acc: Record<string, any[]>, t: any) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">脚本管理</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            输入灵感，AI 自动生成完整分场脚本
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Sparkles className="h-4 w-4 mr-2" />
              新建脚本
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                从灵感生成脚本
              </DialogTitle>
              <DialogDescription>
                输入一句灵感，AI 会自动匹配叙事模板、注入爽点，生成完整的分场脚本。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">灵感 *</label>
                <Textarea
                  placeholder="例如：特朗普送外卖、一个穷小子在咖啡馆被女友羞辱后激活了神豪系统..."
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">参考模板（可选）</label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="自动匹配" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">自动匹配</SelectItem>
                      {Object.entries(templatesByCategory).map(([category, tpls]) => (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{category}</div>
                          {(tpls as any[]).map((t: any) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">目标时长（秒）</label>
                  <Select value={totalDuration} onValueChange={setTotalDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30秒</SelectItem>
                      <SelectItem value="60">60秒</SelectItem>
                      <SelectItem value="90">90秒（推荐）</SelectItem>
                      <SelectItem value="120">120秒</SelectItem>
                      <SelectItem value="180">180秒</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">补充说明（可选）</label>
                <Input
                  placeholder="例如：风格偏搞笑、目标受众是年轻女性..."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={generating}>
                取消
              </Button>
              <Button onClick={handleGenerate} disabled={generating || !idea.trim()}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    AI 生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    生成脚本
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">脚本总数</CardTitle>
            <Film className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{screenplays?.length ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">模板库</CardTitle>
            <BookTemplate className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">可用脚本模板</p>
          </CardContent>
        </Card>
      </div>

      {/* Screenplay List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : screenplays && screenplays.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {screenplays.map((sp: any) => {
            const status = statusMap[sp.status] ?? statusMap.draft;
            const scenes = sp.scenes as any[] ?? [];
            return (
              <Card
                key={sp.id}
                className="cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => navigate(`/screenplay/${sp.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-base truncate flex-1 mr-2">{sp.title}</h3>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    <Lightbulb className="h-3 w-3 inline mr-1" />
                    {sp.idea}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Film className="h-3 w-3" />
                      {sp.sceneCount} 场
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {sp.totalDuration}秒
                    </span>
                    {sp.templateName && (
                      <Badge variant="outline" className="text-xs">
                        {sp.templateName}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <span className="text-xs text-muted-foreground">
                      {new Date(sp.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDelete(sp.id, e)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">还没有脚本</h3>
            <p className="text-sm text-muted-foreground mb-4">
              点击「新建脚本」，输入一句灵感开始创作
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              创建第一个脚本
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
