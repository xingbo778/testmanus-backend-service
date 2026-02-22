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
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Film,
  Clock,
  Users,
  MapPin,
  Sparkles,
  Zap,
  MessageSquare,
  ChevronRight,
  Pencil,
  Save,
  X,
  Loader2,
  ExternalLink,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

const sceneCategoryColors: Record<string, string> = {
  "对话": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "打斗": "bg-red-500/10 text-red-500 border-red-500/20",
  "暧昧": "bg-pink-500/10 text-pink-500 border-pink-500/20",
  "独白": "bg-purple-500/10 text-purple-500 border-purple-500/20",
  "展示": "bg-green-500/10 text-green-500 border-green-500/20",
  "教程": "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  "追逐": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "揭示": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

const shuangdianLevelColors: Record<string, string> = {
  micro: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  mid: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  major: "bg-red-500/10 text-red-600 border-red-500/20",
};

const shuangdianLevelLabels: Record<string, string> = {
  micro: "微爽点",
  mid: "中爽点",
  major: "大爽点",
};

export default function ScreenplayDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const screenplayId = parseInt(params.id ?? "0");

  const { data, isLoading, refetch } = trpc.screenplay.get.useQuery({ id: screenplayId });
  const updateMutation = trpc.screenplay.update.useMutation();
  const updateSceneMutation = trpc.screenplay.updateScene.useMutation();
  const expandMutation = trpc.screenplay.expandToProject.useMutation();
  const expandAllMutation = trpc.screenplay.expandAllToProjects.useMutation();

  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data?.screenplay) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-medium mb-2">脚本不存在</h2>
        <Button variant="outline" onClick={() => navigate("/screenplay")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回列表
        </Button>
      </div>
    );
  }

  const { screenplay } = data;
  const scenes = (screenplay.scenes as any[]) ?? [];
  const characters = (screenplay.characters as any[]) ?? [];
  const settings = (screenplay.settings as any[]) ?? [];

  const handleEditScene = (scene: any) => {
    setEditingScene(scene.index);
    setEditData({
      title: scene.title,
      sceneType: scene.sceneType,
      location: scene.location,
      duration: scene.duration,
      sceneCategory: scene.sceneCategory,
      description: scene.description,
      hook: scene.hook,
      transition: scene.transition,
    });
    setEditDialogOpen(true);
  };

  const handleSaveScene = async () => {
    if (editingScene === null) return;
    try {
      await updateSceneMutation.mutateAsync({
        screenplayId,
        sceneIndex: editingScene,
        data: editData,
      });
      toast.success("场景已更新");
      setEditDialogOpen(false);
      setEditingScene(null);
      refetch();
    } catch (error: any) {
      toast.error(`更新失败: ${error.message}`);
    }
  };

  const handleExpandScene = async (sceneIndex: number) => {
    try {
      const result = await expandMutation.mutateAsync({ screenplayId, sceneIndex });
      toast.success(`已展开为分镜项目 #${result.projectId}`);
      refetch();
    } catch (error: any) {
      toast.error(`展开失败: ${error.message}`);
    }
  };

  const handleExpandAll = async () => {
    if (!confirm("确定要将所有场景展开为分镜项目吗？")) return;
    try {
      const result = await expandAllMutation.mutateAsync({ screenplayId });
      toast.success(`已展开 ${result.results.length} 个场景为分镜项目`);
      refetch();
    } catch (error: any) {
      toast.error(`展开失败: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/screenplay")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{screenplay.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="outline" className="text-xs">
              {screenplay.narrativeArchetype ?? "通用"}
            </Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Film className="h-3 w-3" />
              {screenplay.sceneCount} 场
            </span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {screenplay.totalDuration}秒
            </span>
          </div>
        </div>
        <Button onClick={handleExpandAll} disabled={expandAllMutation.isPending}>
          {expandAllMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Film className="h-4 w-4 mr-2" />
          )}
          全部展开为分镜
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Idea */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              原始灵感
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{screenplay.idea}</p>
          </CardContent>
        </Card>

        {/* Emotion Curve */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              情绪曲线
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{screenplay.emotionCurve ?? "未指定"}</p>
          </CardContent>
        </Card>

        {/* Characters */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              角色 ({characters.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {characters.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-xs">{c.role}</Badge>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground text-xs truncate">{c.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scene Timeline */}
      <div>
        <h2 className="text-lg font-semibold mb-4">分场脚本</h2>
        <div className="space-y-4">
          {scenes.map((scene: any, idx: number) => {
            const catColor = sceneCategoryColors[scene.sceneCategory] ?? "bg-gray-500/10 text-gray-500 border-gray-500/20";
            const dialogue = (scene.dialogue as any[]) ?? [];
            const shuangdian = (scene.shuangdian as any[]) ?? [];
            const hasProject = !!scene.storyboardProjectId;

            return (
              <Card key={idx} className="overflow-hidden">
                <div className="flex">
                  {/* Scene number indicator */}
                  <div className="w-16 sm:w-20 bg-muted/50 flex flex-col items-center justify-center border-r shrink-0">
                    <span className="text-2xl font-bold text-muted-foreground">
                      {String(scene.index).padStart(2, "0")}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">{scene.duration}秒</span>
                  </div>

                  <div className="flex-1 p-4">
                    {/* Scene header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-base">{scene.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-xs border ${catColor}`} variant="outline">
                            {scene.sceneCategory}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {scene.location}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {scene.characters?.join(", ")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditScene(scene)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {hasProject ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => navigate(`/project/${scene.storyboardProjectId}`)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            分镜 #{scene.storyboardProjectId}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleExpandScene(scene.index)}
                            disabled={expandMutation.isPending}
                          >
                            <Film className="h-3 w-3 mr-1" />
                            展开分镜
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* L1 > L2 > L3 mapping */}
                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{scene.l1Id}</span>
                      <ChevronRight className="h-3 w-3" />
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{scene.l2Id}</span>
                      <ChevronRight className="h-3 w-3" />
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{scene.l3Id}</span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground mb-3">{scene.description}</p>

                    {/* Hook */}
                    {scene.hook && (
                      <div className="text-xs bg-yellow-500/5 border border-yellow-500/20 rounded-md px-3 py-2 mb-3">
                        <span className="font-medium text-yellow-600">🪝 钩子：</span>
                        <span className="text-muted-foreground ml-1">{scene.hook}</span>
                      </div>
                    )}

                    <Accordion type="multiple" className="w-full">
                      {/* Dialogue */}
                      {dialogue.length > 0 && (
                        <AccordionItem value="dialogue" className="border-b-0">
                          <AccordionTrigger className="py-2 text-sm hover:no-underline">
                            <span className="flex items-center gap-2">
                              <MessageSquare className="h-3.5 w-3.5" />
                              对白 ({dialogue.length} 句)
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 pl-2">
                              {dialogue.map((d: any, di: number) => (
                                <div key={di} className="flex items-start gap-2 text-sm">
                                  <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                                    {d.character}
                                  </Badge>
                                  <div>
                                    <span>{d.line}</span>
                                    {d.emotion && (
                                      <span className="text-xs text-muted-foreground ml-2">({d.emotion})</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {/* Shuangdian */}
                      {shuangdian.length > 0 && (
                        <AccordionItem value="shuangdian" className="border-b-0">
                          <AccordionTrigger className="py-2 text-sm hover:no-underline">
                            <span className="flex items-center gap-2">
                              <Zap className="h-3.5 w-3.5" />
                              爽点 ({shuangdian.length} 个)
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 pl-2">
                              {shuangdian.map((s: any, si: number) => {
                                const levelColor = shuangdianLevelColors[s.level] ?? shuangdianLevelColors.mid;
                                return (
                                  <div key={si} className="flex items-start gap-2 text-sm">
                                    <Badge className={`text-xs border shrink-0 ${levelColor}`} variant="outline">
                                      {shuangdianLevelLabels[s.level] ?? s.level}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground font-mono">{s.timing}</span>
                                    <span>{s.description}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>

                    {/* Transition */}
                    {scene.transition && idx < scenes.length - 1 && (
                      <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                        ↓ 衔接：{scene.transition}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Edit Scene Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>编辑场景</DialogTitle>
            <DialogDescription>修改场景的基本信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">场景标题</label>
              <Input
                value={editData.title ?? ""}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">场景类型</label>
                <Input
                  value={editData.sceneCategory ?? ""}
                  onChange={(e) => setEditData({ ...editData, sceneCategory: e.target.value })}
                  placeholder="对话/打斗/暧昧..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">时长（秒）</label>
                <Input
                  type="number"
                  value={editData.duration ?? 0}
                  onChange={(e) => setEditData({ ...editData, duration: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">拍摄场景</label>
              <Input
                value={editData.location ?? ""}
                onChange={(e) => setEditData({ ...editData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">剧情描述</label>
              <Textarea
                value={editData.description ?? ""}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">钩子设计</label>
              <Input
                value={editData.hook ?? ""}
                onChange={(e) => setEditData({ ...editData, hook: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">衔接方式</label>
              <Input
                value={editData.transition ?? ""}
                onChange={(e) => setEditData({ ...editData, transition: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleSaveScene} disabled={updateSceneMutation.isPending}>
              {updateSceneMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
