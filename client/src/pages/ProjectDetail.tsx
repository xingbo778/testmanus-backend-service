import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Play, RefreshCw, Wand2, CheckCircle,
  Image as ImageIcon, Pencil, Eye, Loader2, History, RotateCcw,
  Clock, Film, Camera
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_MAP: Record<string, string> = {
  draft: "草稿", scripted: "已生成脚本", grid_generated: "已生成Grid",
  reviewing: "审核中", confirmed: "已确认",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const projectId = parseInt(id || "0");

  const { data, isLoading, refetch } = trpc.project.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const versionHistory = trpc.version.history.useQuery({ projectId }, { enabled: !!projectId });

  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPanel, setSelectedPanel] = useState<number | null>(null);
  const [issueText, setIssueText] = useState("");
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [fixType, setFixType] = useState<"inpaint" | "regenerate" | "reference">("inpaint");
  const [fixPrompt, setFixPrompt] = useState("");
  const [confirmRegenDialog, setConfirmRegenDialog] = useState<{ step: string; action: () => void } | null>(null);
  const [rollbackDialog, setRollbackDialog] = useState<{ version: number } | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  // Mutations
  const generateScript = trpc.script.generate.useMutation({
    onSuccess: () => { toast.success("脚本生成成功"); refetch(); versionHistory.refetch(); },
    onError: (err: any) => toast.error(`脚本生成失败: ${err.message}`),
  });

  const generateGrid = trpc.grid.generate.useMutation({
    onSuccess: () => { toast.success("Grid生成成功"); refetch(); versionHistory.refetch(); },
    onError: (err: any) => toast.error(`Grid生成失败: ${err.message}`),
  });

  const generatePrompts = trpc.prompt.generate.useMutation({
    onSuccess: () => { toast.success("Prompt生成成功"); refetch(); versionHistory.refetch(); },
    onError: (err: any) => toast.error(`Prompt生成失败: ${err.message}`),
  });

  const flagPanel = trpc.panel.flag.useMutation({
    onSuccess: () => { toast.success("面板已标记"); refetch(); setFixDialogOpen(false); },
    onError: (err: any) => toast.error(`标记失败: ${err.message}`),
  });

  const fixPanelMut = trpc.panel.fix.useMutation({
    onSuccess: () => { toast.success("面板修复成功"); refetch(); setFixDialogOpen(false); },
    onError: (err: any) => toast.error(`修复失败: ${err.message}`),
  });

  const confirmProject = trpc.project.update.useMutation({
    onSuccess: () => { toast.success("项目已确认"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const rollbackMut = trpc.version.rollback.useMutation({
    onSuccess: (result) => {
      toast.success(`已回退到版本 v${result.version}`);
      refetch();
      versionHistory.refetch();
      setRollbackDialog(null);
    },
    onError: (err: any) => toast.error(`回退失败: ${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data?.project) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground mb-4">项目不存在</p>
        <Button variant="outline" onClick={() => navigate("/browse")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回浏览
        </Button>
      </div>
    );
  }

  const { project, script, anchors, grid, panels, prompts } = data;

  // Parse script frames
  const scriptFrames = (() => {
    if (!script?.frames) return [];
    try {
      const raw = typeof script.frames === "string" ? JSON.parse(script.frames as string) : script.frames;
      return Array.isArray(raw) ? raw : (raw?.frames ?? []);
    } catch { return []; }
  })();

  const scriptCharacters = (() => {
    if (!script?.characters) return [];
    try {
      const raw = typeof script.characters === "string" ? JSON.parse(script.characters as string) : script.characters;
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  })();

  const scriptScenes = (() => {
    if (!script?.scenes) return [];
    try {
      const raw = typeof script.scenes === "string" ? JSON.parse(script.scenes as string) : script.scenes;
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/browse")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{project.duration}秒</Badge>
              <Badge variant={project.status === "confirmed" ? "default" : "secondary"}>
                {STATUS_MAP[project.status] || project.status}
              </Badge>
              <span className="text-xs text-muted-foreground">v{project.currentVersion}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryDialogOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            历史版本
          </Button>
          {project.status !== "confirmed" && (
            <Button
              variant="default"
              onClick={() => confirmProject.mutate({ id: projectId, status: "confirmed" })}
              disabled={confirmProject.isPending || !prompts?.length}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              确认项目
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="script">脚本</TabsTrigger>
          <TabsTrigger value="grid">Grid</TabsTrigger>
          <TabsTrigger value="prompts">Prompt</TabsTrigger>
        </TabsList>

        {/* ==================== Overview Tab ==================== */}
        <TabsContent value="overview" className="space-y-4">
          {/* Workflow Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">工作流进度</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <WorkflowStep
                step={1}
                title="生成脚本"
                done={!!script}
                loading={generateScript.isPending}
                onView={() => setActiveTab("script")}
                onRegenerate={() => setConfirmRegenDialog({
                  step: "脚本",
                  action: () => generateScript.mutate({ projectId }),
                })}
              />
              <WorkflowStep
                step={2}
                title="生成Anchor & Grid"
                done={!!grid}
                loading={generateGrid.isPending}
                onView={() => setActiveTab("grid")}
                onRegenerate={() => setConfirmRegenDialog({
                  step: "Anchor & Grid",
                  action: () => generateGrid.mutate({ projectId }),
                })}
                disabled={!script}
              />
              <WorkflowStep
                step={3}
                title="审查与调整"
                done={project.status === "reviewing" || project.status === "confirmed"}
                onView={() => setActiveTab("grid")}
                disabled={!grid}
              />
              <WorkflowStep
                step={4}
                title="生成Prompt"
                done={!!prompts?.length}
                loading={generatePrompts.isPending}
                onView={() => setActiveTab("prompts")}
                onRegenerate={() => setConfirmRegenDialog({
                  step: "Prompt",
                  action: () => generatePrompts.mutate({ projectId }),
                })}
                disabled={!grid}
              />
              <WorkflowStep
                step={5}
                title="确认导出"
                done={project.status === "confirmed"}
                onView={() => {}}
                onRegenerate={() => confirmProject.mutate({ id: projectId, status: "confirmed" })}
                disabled={!prompts?.length}
                confirmLabel="确认"
              />
            </CardContent>
          </Card>

          {/* Script Summary + Grid Preview side by side */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Script Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  脚本概要
                </CardTitle>
              </CardHeader>
              <CardContent>
                {script && scriptFrames.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      共 {scriptFrames.length} 帧 · 总时长 {scriptFrames.reduce((sum: number, f: any) => sum + (f.duration || 0), 0).toFixed(1)}s
                    </div>
                    <div className="space-y-1.5">
                      {scriptFrames.slice(0, 6).map((f: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <Badge variant="outline" className="text-xs shrink-0 font-mono w-6 justify-center">{f.index || i + 1}</Badge>
                          <Badge variant="secondary" className="text-xs shrink-0">{f.shotType || "-"}</Badge>
                          <span className="text-muted-foreground line-clamp-1">{f.description || "-"}</span>
                        </div>
                      ))}
                      {scriptFrames.length > 6 && (
                        <p className="text-xs text-muted-foreground pl-2">...还有 {scriptFrames.length - 6} 帧</p>
                      )}
                    </div>
                    {/* Characters */}
                    {scriptCharacters.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium mb-1">角色</p>
                        <div className="flex flex-wrap gap-1">
                          {scriptCharacters.map((c: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">{c.name}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab("script")}>
                      查看完整脚本 →
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Film className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">尚未生成脚本</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grid Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Grid预览
                </CardTitle>
              </CardHeader>
              <CardContent>
                {grid?.gridImageUrl ? (
                  <div className="space-y-2">
                    <img
                      src={grid.gridImageUrl}
                      alt="Storyboard Grid"
                      className="w-full rounded-lg border"
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>布局: {grid.rows}×{grid.cols}</span>
                      <span>·</span>
                      <span>v{grid.version}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab("grid")}>
                      查看详情 →
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ImageIcon className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">尚未生成Grid</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Anchors Preview in Overview */}
          {anchors && anchors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  锚点参考图
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {anchors.map((a: any) => (
                    <div key={a.id} className="space-y-1 text-center">
                      {a.imageUrl ? (
                        <img src={a.imageUrl} alt={a.name} className="w-full aspect-square object-cover rounded-lg border" />
                      ) : (
                        <div className="w-full aspect-square bg-muted/30 rounded-lg flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <p className="text-xs font-medium truncate">{a.name}</p>
                      <Badge variant="outline" className="text-[10px]">{a.anchorType === "character" ? "角色" : a.anchorType === "scene" ? "场景" : "道具"}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ==================== Script Tab ==================== */}
        <TabsContent value="script" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">分镜脚本</CardTitle>
              <Button
                size="sm"
                onClick={() => setConfirmRegenDialog({
                  step: "脚本",
                  action: () => generateScript.mutate({ projectId }),
                })}
                disabled={generateScript.isPending}
              >
                {generateScript.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {script ? "重新生成" : "生成脚本"}
              </Button>
            </CardHeader>
            <CardContent>
              {script && scriptFrames.length > 0 ? (
                <div className="space-y-4">
                  {/* Validation Results */}
                  {script.validationResult != null && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium mb-2">校验结果</p>
                      <pre className="text-xs overflow-auto whitespace-pre-wrap">
                        {String(typeof script.validationResult === 'string'
                          ? script.validationResult
                          : JSON.stringify(script.validationResult, null, 2))}
                      </pre>
                    </div>
                  )}
                  {/* Frames Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left w-12">#</th>
                          <th className="px-3 py-2 text-left w-20">景别</th>
                          <th className="px-3 py-2 text-left w-16">时长</th>
                          <th className="px-3 py-2 text-left">描述</th>
                          <th className="px-3 py-2 text-left w-24">运镜</th>
                          <th className="px-3 py-2 text-left w-32">备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scriptFrames.map((f: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs">{f.index || i + 1}</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-xs">{f.shotType || "-"}</Badge>
                            </td>
                            <td className="px-3 py-2 text-xs">{f.duration || "-"}s</td>
                            <td className="px-3 py-2 text-xs">{f.description || "-"}</td>
                            <td className="px-3 py-2 text-xs">{f.cameraMovement || f.cameraMove || "-"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{f.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Characters & Scenes */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {scriptCharacters.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">角色</p>
                        <div className="space-y-2">
                          {scriptCharacters.map((c: any, i: number) => (
                            <div key={i} className="p-2 rounded border text-xs">
                              <span className="font-medium">{c.name}</span>
                              <span className="text-muted-foreground ml-2">{c.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {scriptScenes.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">场景</p>
                        <div className="space-y-2">
                          {scriptScenes.map((s: any, i: number) => (
                            <div key={i} className="p-2 rounded border text-xs">
                              <span className="font-medium">{s.name}</span>
                              <span className="text-muted-foreground ml-2">{s.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">点击"生成脚本"开始</p>
              )}
            </CardContent>
          </Card>

          {/* Anchors Section */}
          {anchors && anchors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">锚点参考图 (Anchors)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {anchors.map((a: any) => (
                    <div key={a.id} className="space-y-1">
                      {a.imageUrl ? (
                        <img src={a.imageUrl} alt={a.name} className="w-full aspect-square object-cover rounded-lg border" />
                      ) : (
                        <div className="w-full aspect-square bg-muted/30 rounded-lg flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <p className="text-xs font-medium truncate">{a.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {a.anchorType === "character" ? "角色" : a.anchorType === "scene" ? "场景" : "道具"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ==================== Grid Tab ==================== */}
        <TabsContent value="grid" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">分镜Grid</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmRegenDialog({
                    step: "Grid",
                    action: () => generateGrid.mutate({ projectId }),
                  })}
                  disabled={generateGrid.isPending || !script}
                >
                  {generateGrid.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  重新生成Grid
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {grid?.gridImageUrl ? (
                <div className="space-y-4">
                  <img
                    src={grid.gridImageUrl}
                    alt="Storyboard Grid"
                    className="w-full rounded-lg border"
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>布局: {grid.rows}×{grid.cols}</span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>版本: v{grid.version}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mb-4 opacity-30" />
                  <p>尚未生成Grid，请先生成脚本</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Panel List with Fix Actions */}
          {panels && panels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">面板列表（点击面板标记问题）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {panels.map((p: any) => (
                    <div
                      key={p.id}
                      className={`relative rounded-lg border-2 p-2 cursor-pointer transition-all hover:shadow-md ${
                        selectedPanel === p.panelIndex ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}
                      onClick={() => {
                        setSelectedPanel(p.panelIndex);
                        setFixDialogOpen(true);
                      }}
                    >
                      <div className="absolute top-1 left-1 bg-background/80 rounded px-1.5 py-0.5 text-xs font-mono">
                        #{p.panelIndex}
                      </div>
                      {p.panelImageUrl ? (
                        <img src={p.panelImageUrl} alt={`Panel ${p.panelIndex}`} className="w-full aspect-video object-cover rounded" />
                      ) : (
                        <div className="w-full aspect-video bg-muted/30 rounded flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="mt-1.5 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">{p.shotType || "-"}</Badge>
                          {p.duration && <span className="text-[10px] text-muted-foreground">{p.duration}s</span>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{p.description || "-"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fix Dialog */}
          <Dialog open={fixDialogOpen} onOpenChange={setFixDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>修复面板 #{selectedPanel}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>问题描述</Label>
                  <Textarea
                    placeholder="描述这个面板的问题..."
                    value={issueText}
                    onChange={(e) => setIssueText(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>修复方式</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "inpaint" as const, label: "局部修复", icon: Pencil },
                      { value: "regenerate" as const, label: "重新生成", icon: RefreshCw },
                      { value: "reference" as const, label: "参考图生成", icon: ImageIcon },
                    ].map((opt) => (
                      <Button
                        key={opt.value}
                        variant={fixType === opt.value ? "default" : "outline"}
                        className="flex flex-col h-auto py-3"
                        onClick={() => setFixType(opt.value)}
                      >
                        <opt.icon className="h-4 w-4 mb-1" />
                        <span className="text-xs">{opt.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>修复提示词</Label>
                  <Textarea
                    placeholder="输入修复的具体要求..."
                    value={fixPrompt}
                    onChange={(e) => setFixPrompt(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFixDialogOpen(false)}>取消</Button>
                <Button
                  onClick={() => {
                    if (selectedPanel === null) return;
                    const panel = panels?.find((p: any) => p.panelIndex === selectedPanel);
                    if (panel) {
                      fixPanelMut.mutate({
                        panelId: panel.id,
                        fixType: fixType === "reference" ? "reference_based" : fixType,
                        modifiedDescription: fixPrompt || undefined,
                      });
                    }
                  }}
                  disabled={fixPanelMut.isPending}
                >
                  {fixPanelMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  执行修复
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ==================== Prompts Tab ==================== */}
        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">视频生成Prompt</CardTitle>
              <Button
                size="sm"
                onClick={() => setConfirmRegenDialog({
                  step: "Prompt",
                  action: () => generatePrompts.mutate({ projectId }),
                })}
                disabled={generatePrompts.isPending || !grid}
              >
                {generatePrompts.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {prompts?.length ? "重新生成" : "生成Prompt"}
              </Button>
            </CardHeader>
            <CardContent>
              {prompts && prompts.length > 0 ? (
                <div className="space-y-3">
                  {prompts.map((p: any, idx: number) => {
                    // Find matching panel to get correct panelIndex
                    const matchingPanel = panels?.find((pan: any) => pan.id === p.panelId);
                    const displayIndex = matchingPanel?.panelIndex ?? (idx + 1);
                    const matchingFrame = scriptFrames.find((f: any) => f.index === displayIndex);
                    const duration = matchingPanel?.duration || matchingFrame?.duration;

                    return (
                      <div key={p.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono">#{displayIndex}</Badge>
                            <Badge variant="secondary">{p.model || "auto"}</Badge>
                            <Badge variant="secondary">{p.controlStrategy || "first_frame"}</Badge>
                            {p.shotType && <Badge variant="outline" className="text-xs">{p.shotType}</Badge>}
                            {duration && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {duration}s
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm">{p.promptText}</p>
                        {p.negativePrompt && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-destructive">Negative:</span> {p.negativePrompt}
                          </p>
                        )}
                        {/* Structured details */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {p.cameraAngle && <span>视角: {p.cameraAngle}</span>}
                          {p.cameraMovement && <span>运镜: {p.cameraMovement}</span>}
                          {p.lighting && <span>光线: {p.lighting}</span>}
                          {p.transition && <span>过渡: {p.transition}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  {grid ? "点击生成Prompt开始" : "请先生成Grid"}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== Confirm Regenerate Dialog ==================== */}
      <Dialog open={!!confirmRegenDialog} onOpenChange={(open) => !open && setConfirmRegenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认重新生成</DialogTitle>
            <DialogDescription>
              确定要重新生成{confirmRegenDialog?.step}吗？这将创建一个新版本，当前版本不会被删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRegenDialog(null)}>取消</Button>
            <Button onClick={() => {
              confirmRegenDialog?.action();
              setConfirmRegenDialog(null);
            }}>
              确认重新生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== History Dialog ==================== */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>历史版本</DialogTitle>
            <DialogDescription>查看和回退到历史版本</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Script versions */}
            <div>
              <p className="text-sm font-medium mb-2">脚本版本</p>
              {versionHistory.data?.scriptVersions?.length ? (
                <div className="space-y-1.5">
                  {versionHistory.data.scriptVersions.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2 rounded border text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={v.version === project.currentVersion ? "default" : "outline"} className="text-xs">
                          v{v.version}
                        </Badge>
                        <span className="text-muted-foreground">
                          {v.createdAt ? new Date(v.createdAt).toLocaleString() : "-"}
                        </span>
                        {v.validationPassed != null && (
                          <Badge variant={v.validationPassed ? "default" : "secondary"} className="text-[10px]">
                            {v.validationPassed ? "校验通过" : "未通过"}
                          </Badge>
                        )}
                      </div>
                      {v.version !== project.currentVersion && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => { setHistoryDialogOpen(false); setRollbackDialog({ version: v.version }); }}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          回退
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">暂无版本</p>}
            </div>

            {/* Grid versions */}
            <div>
              <p className="text-sm font-medium mb-2">Grid版本</p>
              {versionHistory.data?.gridVersions?.length ? (
                <div className="space-y-1.5">
                  {versionHistory.data.gridVersions.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2 rounded border text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={v.version === project.currentVersion ? "default" : "outline"} className="text-xs">
                          v{v.version}
                        </Badge>
                        <span className="text-muted-foreground">
                          {v.createdAt ? new Date(v.createdAt).toLocaleString() : "-"}
                        </span>
                        <span className="text-muted-foreground">{v.rows}×{v.cols}</span>
                      </div>
                      {v.gridImageUrl && (
                        <img src={v.gridImageUrl} alt={`Grid v${v.version}`} className="h-8 w-12 object-cover rounded border" />
                      )}
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">暂无版本</p>}
            </div>

            {/* Prompt versions */}
            <div>
              <p className="text-sm font-medium mb-2">Prompt版本</p>
              {versionHistory.data?.promptVersions?.length ? (
                <div className="space-y-1.5">
                  {versionHistory.data.promptVersions.map((v: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded border text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={v.version === project.currentVersion ? "default" : "outline"} className="text-xs">
                          v{v.version}
                        </Badge>
                        <span className="text-muted-foreground">
                          {v.createdAt ? new Date(v.createdAt).toLocaleString() : "-"}
                        </span>
                        <span className="text-muted-foreground">{v.count} 条prompt</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">暂无版本</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== Rollback Confirm Dialog ==================== */}
      <Dialog open={!!rollbackDialog} onOpenChange={(open) => !open && setRollbackDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认回退</DialogTitle>
            <DialogDescription>
              确定要回退到版本 v{rollbackDialog?.version} 吗？当前版本的数据不会被删除，但项目将切换到目标版本。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackDialog(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rollbackDialog) {
                  rollbackMut.mutate({ projectId, targetVersion: rollbackDialog.version });
                }
              }}
              disabled={rollbackMut.isPending}
            >
              {rollbackMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              确认回退
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkflowStep({
  step, title, done, loading, onView, onRegenerate, disabled, confirmLabel
}: {
  step: number; title: string; done: boolean; loading?: boolean;
  onView?: () => void; onRegenerate?: () => void; disabled?: boolean; confirmLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          {done ? <CheckCircle className="h-4 w-4" /> : step}
        </div>
        <span className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>{title}</span>
      </div>
      <div className="flex items-center gap-1">
        {done && onView && (
          <Button size="sm" variant="ghost" onClick={onView} disabled={disabled}>
            <Eye className="h-4 w-4 mr-1" />
            <span className="text-xs">查看</span>
          </Button>
        )}
        {onRegenerate && (
          <Button
            size="sm"
            variant={done ? "outline" : "default"}
            onClick={onRegenerate}
            disabled={disabled || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : (
              done ? <RefreshCw className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />
            )}
            <span className="text-xs">{confirmLabel || (done ? "重新生成" : "执行")}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
