import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Play, RefreshCw, Wand2, CheckCircle, AlertTriangle,
  Image as ImageIcon, Upload, Pencil, Eye, Download, Loader2
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState, useCallback } from "react";
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

  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPanel, setSelectedPanel] = useState<number | null>(null);
  const [issueText, setIssueText] = useState("");
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [fixType, setFixType] = useState<"inpaint" | "regenerate" | "reference">("inpaint");
  const [fixPrompt, setFixPrompt] = useState("");

  // Mutations
  const generateScript = trpc.script.generate.useMutation({
    onSuccess: () => { toast.success("脚本生成成功"); refetch(); },
    onError: (err: any) => toast.error(`脚本生成失败: ${err.message}`),
  });

  const generateGrid = trpc.grid.generate.useMutation({
    onSuccess: () => { toast.success("Grid生成成功"); refetch(); },
    onError: (err: any) => toast.error(`Grid生成失败: ${err.message}`),
  });

  const generatePrompts = trpc.prompt.generate.useMutation({
    onSuccess: () => { toast.success("Prompt生成成功"); refetch(); },
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

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
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
                  onAction={() => generateScript.mutate({ projectId })}
                />
                <WorkflowStep
                  step={2}
                  title="生成Anchor & Grid"
                  done={!!grid}
                  loading={generateGrid.isPending}
                  onAction={() => generateGrid.mutate({ projectId })}
                  disabled={!script}
                />
                <WorkflowStep
                  step={3}
                  title="审查与调整"
                  done={project.status === "reviewing" || project.status === "confirmed"}
                  onAction={() => setActiveTab("grid")}
                  disabled={!grid}
                  actionLabel="查看Grid"
                />
                <WorkflowStep
                  step={4}
                  title="生成Prompt"
                  done={!!prompts?.length}
                  loading={generatePrompts.isPending}
                  onAction={() => generatePrompts.mutate({ projectId })}
                  disabled={!grid}
                />
                <WorkflowStep
                  step={5}
                  title="确认导出"
                  done={project.status === "confirmed"}
                  onAction={() => confirmProject.mutate({ id: projectId, status: "confirmed" })}
                  disabled={!prompts?.length}
                  actionLabel="确认"
                />
              </CardContent>
            </Card>

            {/* Grid Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Grid预览</CardTitle>
              </CardHeader>
              <CardContent>
                {grid?.gridImageUrl ? (
                  <img
                    src={grid.gridImageUrl}
                    alt="Storyboard Grid"
                    className="w-full rounded-lg border"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-4 opacity-30" />
                    <p>尚未生成Grid</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Script Tab */}
        <TabsContent value="script" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">分镜脚本</CardTitle>
              <Button
                size="sm"
                onClick={() => generateScript.mutate({ projectId })}
                disabled={generateScript.isPending}
              >
                {generateScript.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {script ? "重新生成" : "生成脚本"}
              </Button>
            </CardHeader>
            <CardContent>
              {script ? (
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
                  {/* Script Content */}
                  <div className="space-y-2">
                    {(() => {
                      try {
                        const content = typeof script.frames === 'string' ? JSON.parse(script.frames as string) : (script.frames as any);
                        if (content?.frames) {
                          return (
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="px-3 py-2 text-left w-12">#</th>
                                    <th className="px-3 py-2 text-left w-20">景别</th>
                                    <th className="px-3 py-2 text-left w-16">时长</th>
                                    <th className="px-3 py-2 text-left">描述</th>
                                    <th className="px-3 py-2 text-left w-24">运镜</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {content.frames.map((f: any, i: number) => (
                                    <tr key={i} className="border-t">
                                      <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                                      <td className="px-3 py-2">
                                        <Badge variant="outline" className="text-xs">{f.shotType || f.shot_type || "-"}</Badge>
                                      </td>
                                      <td className="px-3 py-2 text-xs">{f.duration || "-"}s</td>
                                      <td className="px-3 py-2 text-xs">{f.description || f.desc || "-"}</td>
                                      <td className="px-3 py-2 text-xs">{f.cameraMove || f.camera_move || "-"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        }
                        return <pre className="text-xs overflow-auto whitespace-pre-wrap bg-muted/30 p-4 rounded-lg">{JSON.stringify(content, null, 2)}</pre>;
                      } catch {
                        return <pre className="text-xs overflow-auto whitespace-pre-wrap bg-muted/30 p-4 rounded-lg">{JSON.stringify(script.frames, null, 2)}</pre>;
                      }
                    })()}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">点击"生成脚本"开始</p>
              )}
            </CardContent>
          </Card>

          {/* Anchors */}
          {anchors && anchors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">锚点参考图 (Anchors)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {anchors.map((a: any) => (
                    <div key={a.id} className="space-y-1">
                      {a.imageUrl && (
                        <img src={a.imageUrl} alt={a.name} className="w-full aspect-square object-cover rounded-lg border" />
                      )}
                      <p className="text-xs font-medium truncate">{a.name}</p>
                      <Badge variant="outline" className="text-xs">{a.anchorType}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Grid Tab */}
        <TabsContent value="grid" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">分镜Grid</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateGrid.mutate({ projectId })}
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
                        #{p.panelIndex + 1}
                      </div>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={`Panel ${p.panelIndex + 1}`} className="w-full aspect-video object-cover rounded" />
                      ) : (
                        <div className="w-full aspect-video bg-muted/30 rounded flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="mt-1.5 space-y-0.5">
                        <Badge variant="outline" className="text-xs">{p.shotType || "-"}</Badge>
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
                <DialogTitle>修复面板 #{(selectedPanel ?? 0) + 1}</DialogTitle>
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
                    // First flag, then fix
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

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">视频生成Prompt</CardTitle>
              <Button
                size="sm"
                onClick={() => generatePrompts.mutate({ projectId })}
                disabled={generatePrompts.isPending || !grid}
              >
                {generatePrompts.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {prompts?.length ? "重新生成" : "生成Prompt"}
              </Button>
            </CardHeader>
            <CardContent>
              {prompts && prompts.length > 0 ? (
                <div className="space-y-3">
                  {prompts.map((p: any) => (
                    <div key={p.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">#{p.panelIndex + 1}</Badge>
                          <Badge variant="secondary">{p.model || "auto"}</Badge>
                          <Badge variant="secondary">{p.controlStrategy || "first_frame"}</Badge>
                        </div>
                      </div>
                      <p className="text-sm">{p.promptText}</p>
                      {p.negativePrompt && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-destructive">Negative:</span> {p.negativePrompt}
                        </p>
                      )}
                    </div>
                  ))}
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
    </div>
  );
}

function WorkflowStep({
  step, title, done, loading, onAction, disabled, actionLabel
}: {
  step: number; title: string; done: boolean; loading?: boolean;
  onAction: () => void; disabled?: boolean; actionLabel?: string;
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
      <Button
        size="sm"
        variant={done ? "ghost" : "outline"}
        onClick={onAction}
        disabled={disabled || loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          done ? <Eye className="h-4 w-4" /> : <Play className="h-4 w-4" />
        )}
        <span className="ml-1 text-xs">{actionLabel || (done ? "查看" : "执行")}</span>
      </Button>
    </div>
  );
}
