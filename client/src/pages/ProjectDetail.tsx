import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Play, RefreshCw, Wand2, CheckCircle,
  Image as ImageIcon, Pencil, Eye, Loader2, History, RotateCcw,
  Clock, Film, Camera, FileText, Sparkles, Plus, Trash2, Save, X, Download,
  Library, Upload, AlertTriangle, AlertCircle, Info
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import MaskCanvas from "@/components/MaskCanvas";

const STATUS_MAP: Record<string, string> = {
  draft: "草稿", scripted: "已生成脚本", anchors_generated: "已生成Anchor",
  grid_generating: "Grid生成中...", grid_generated: "已生成Grid",
  prompt_generated: "已生成Prompt", reviewing: "审核中", confirmed: "已确认",
};

const SHOT_TYPES = ["特写", "近景", "中景", "中远景", "远景", "全景", "大特写", "鸟瞰", "仰拍", "俯拍"];
const CAMERA_MOVES = ["固定", "推", "拉", "摇", "移", "跟", "升", "降", "旋转", "手持", "稳定器跟拍", "无人机航拍"];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const projectId = parseInt(id || "0");

  const { data, isLoading, refetch } = trpc.project.get.useQuery({ id: projectId }, { enabled: !!projectId });
  const versionHistory = trpc.version.history.useQuery({ projectId }, { enabled: !!projectId });
  const validation30 = trpc.script.validate30PercentRule.useQuery({ projectId }, { enabled: !!projectId });

  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPanel, setSelectedPanel] = useState<number | null>(null);
  const [issueText, setIssueText] = useState("");
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [fixType, setFixType] = useState<"inpaint" | "regenerate" | "reference">("inpaint");
  const [fixPrompt, setFixPrompt] = useState("");
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [confirmRegenDialog, setConfirmRegenDialog] = useState<{ step: string; action: () => void } | null>(null);
  const [rollbackDialog, setRollbackDialog] = useState<{ version: number } | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [promptViewDialog, setPromptViewDialog] = useState<{ title: string; prompts: Array<{ label: string; text: string }> } | null>(null);

  // Frame editing state
  const [editingFrame, setEditingFrame] = useState<{ index: number; data: any } | null>(null);
  const [addFrameDialog, setAddFrameDialog] = useState<{ afterIndex: number } | null>(null);
  const [newFrame, setNewFrame] = useState({ shotType: "中景", duration: 2, description: "", cameraMovement: "固定", notes: "" });
  const [deleteFrameDialog, setDeleteFrameDialog] = useState<number | null>(null);

  // Anchor editing state
  const [anchorEditDialog, setAnchorEditDialog] = useState<{ anchor: any; customPrompt: string } | null>(null);

  // Anchor library import dialog
  const [anchorLibImportDialog, setAnchorLibImportDialog] = useState(false);
  const [anchorLibSearch, setAnchorLibSearch] = useState("");
  const [anchorLibTypeFilter, setAnchorLibTypeFilter] = useState<string>("all");
  const [selectedLibAnchors, setSelectedLibAnchors] = useState<number[]>([]);
  // Anchor export to library dialog
  const [anchorExportDialog, setAnchorExportDialog] = useState<{ anchor: any } | null>(null);
  const [exportTags, setExportTags] = useState("");
  const [exportStyle, setExportStyle] = useState("");

  // Fix panel reference image selection
  const [selectedRefImages, setSelectedRefImages] = useState<string[]>([]);

  // Multi-grid page navigation
  const [activeGridPage, setActiveGridPage] = useState(0);

  // Mutations
  const generateScript = trpc.script.generate.useMutation({
    onSuccess: () => { toast.success("脚本生成成功"); refetch(); versionHistory.refetch(); },
    onError: (err: any) => toast.error(`脚本生成失败: ${err.message}`),
  });

  const generateAnchor = trpc.anchor.generate.useMutation({
    onSuccess: () => { toast.success("Anchor生成成功"); refetch(); versionHistory.refetch(); },
    onError: (err: any) => toast.error(`Anchor生成失败: ${err.message}`),
  });

  const regenerateOneAnchor = trpc.anchor.regenerateOne.useMutation({
    onSuccess: () => { toast.success("Anchor重新生成成功"); refetch(); setAnchorEditDialog(null); },
    onError: (err: any) => toast.error(`Anchor重新生成失败: ${err.message}`),
  });

  const importFromLibrary = trpc.anchor.importFromLibrary.useMutation({
    onSuccess: (data) => { toast.success(`成功导入 ${data.imported.length} 个 Anchor`); refetch(); setAnchorLibImportDialog(false); setSelectedLibAnchors([]); },
    onError: (err: any) => toast.error(`导入失败: ${err.message}`),
  });

  const exportToLibrary = trpc.anchor.exportToLibrary.useMutation({
    onSuccess: () => { toast.success("已导出到Anchor库"); setAnchorExportDialog(null); setExportTags(""); setExportStyle(""); },
    onError: (err: any) => toast.error(`导出失败: ${err.message}`),
  });

  // Anchor library query (only when import dialog is open)
  const anchorLibQuery = trpc.anchorLib.list.useQuery(
    { search: anchorLibSearch || undefined, anchorType: anchorLibTypeFilter !== "all" ? anchorLibTypeFilter as any : undefined, limit: 50 },
    { enabled: anchorLibImportDialog }
  );

  const generateGrid = trpc.grid.generate.useMutation({
    onSuccess: (result: any) => {
      if (result?.status === "generating") {
        toast.info(`Grid生成已启动（${result.totalFrames}帧 → ${result.totalPages}页），后台处理中...`);
        // Start auto-polling to check for completion
        startGridPolling();
      } else {
        toast.success("Grid生成成功");
        refetch();
      }
      versionHistory.refetch();
    },
    onError: (err: any) => toast.error(`Grid生成失败: ${err.message}`),
  });

  const regenerateGridFromPanels = trpc.grid.regenerateFromPanels.useMutation({
    onSuccess: (result: any) => { toast.success(`Grid重新合成成功！已更新 ${result.modifiedPanels?.length || 0} 个面板`); refetch(); versionHistory.refetch(); },
    onError: (err: any) => toast.error(`Grid重新合成失败: ${err.message}`),
  });

  // Segmented export dialog
  const [segmentedExportDialog, setSegmentedExportDialog] = useState<{ segments: Array<{ index: number; startPanel: number; endPanel: number; totalDuration: number; panels: any[]; text: string }>; strategy: string } | null>(null);

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

  // Frame editing mutations
  const updateFrame = trpc.script.updateFrame.useMutation({
    onSuccess: () => { toast.success("镜头已更新"); refetch(); setEditingFrame(null); },
    onError: (err: any) => toast.error(`更新失败: ${err.message}`),
  });

  const addFrame = trpc.script.addFrame.useMutation({
    onSuccess: () => { toast.success("镜头已添加"); refetch(); setAddFrameDialog(null); setNewFrame({ shotType: "中景", duration: 2, description: "", cameraMovement: "固定", notes: "" }); },
    onError: (err: any) => toast.error(`添加失败: ${err.message}`),
  });

  const removeFrame = trpc.script.removeFrame.useMutation({
    onSuccess: () => { toast.success("镜头已删除"); refetch(); setDeleteFrameDialog(null); },
    onError: (err: any) => toast.error(`删除失败: ${err.message}`),
  });

  // Panel extraction
  const extractPanelsMut = trpc.panel.extractAll.useMutation({
    onSuccess: (result: any) => { toast.success(`已提取 ${result.panels?.length ?? 0} 个面板图片`); refetch(); },
    onError: (err: any) => toast.error(`提取失败: ${err.message}`),
  });

  // Grid generation polling (async mode)
  const [isGridPolling, setIsGridPolling] = useState(false);
  const gridPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startGridPolling = () => {
    setIsGridPolling(true);
  };

  // Video mutations
  const videoClips = trpc.video.clips.useQuery({ projectId }, { enabled: !!projectId });
  const finalVideos = trpc.video.finalVideos.useQuery({ projectId }, { enabled: !!projectId });
  const [videoModel, setVideoModel] = useState("doubao-seedance-1-5-pro-251215");
  const [isPolling, setIsPolling] = useState(false);
  const [showFailedClips, setShowFailedClips] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateClipsMut = trpc.video.generateClips.useMutation({
    onSuccess: (result) => {
      toast.success(`已提交 ${result.clips.length} 个视频生成任务，后台处理中...`);
      videoClips.refetch();
      setIsPolling(true);
    },
    onError: (err: any) => toast.error(`视频生成失败: ${err.message}`),
  });

  const pollClipsMut = trpc.video.pollClipStatus.useMutation({
    onSuccess: (result) => {
      videoClips.refetch();
      if (result.allCompleted) {
        setIsPolling(false);
        toast.success("所有视频clip已完成");
      }
    },
  });

  const clearFailedClipsMut = trpc.video.clearFailedClips.useMutation({
    onSuccess: (result) => {
      toast.success(`已清除 ${result.deleted} 个失败的clip`);
      videoClips.refetch();
    },
    onError: (err: any) => toast.error(`清除失败: ${err.message}`),
  });

  const clearAllClipsMut = trpc.video.clearAllClips.useMutation({
    onSuccess: (result) => {
      toast.success(`已清除 ${result.deleted} 个clip`);
      videoClips.refetch();
    },
    onError: (err: any) => toast.error(`清除失败: ${err.message}`),
  });

  const mergeClipsMut = trpc.video.mergeClips.useMutation({
    onSuccess: (result) => {
      toast.success(`视频合并完成！总时长: ${result.totalDuration.toFixed(1)}秒`);
      finalVideos.refetch();
    },
    onError: (err: any) => toast.error(`视频合并失败: ${err.message}`),
  });

  const proxyImagesMut = trpc.util.proxyImages.useMutation();

  const confirmFinalMut = trpc.video.confirmFinal.useMutation({
    onSuccess: () => {
      toast.success("最终视频已确认！项目完成");
      refetch();
      finalVideos.refetch();
    },
    onError: (err: any) => toast.error(`确认失败: ${err.message}`),
  });

  // Auto-poll grid generation (async mode)
  useEffect(() => {
    if (data?.project?.status === "grid_generating" && !isGridPolling) {
      setIsGridPolling(true);
    }
  }, [data?.project?.status]);

  useEffect(() => {
    if (isGridPolling) {
      gridPollTimerRef.current = setInterval(() => {
        refetch().then((result) => {
          const status = result.data?.project?.status;
          if (status && status !== "grid_generating") {
            setIsGridPolling(false);
            if (status === "grid_generated") {
              toast.success("Grid生成完成！");
            }
            versionHistory.refetch();
          }
        });
      }, 8000);
      // Immediate first poll after 3s
      const t = setTimeout(() => refetch(), 3000);
      return () => { clearTimeout(t); if (gridPollTimerRef.current) clearInterval(gridPollTimerRef.current); };
    }
    return () => {
      if (gridPollTimerRef.current) clearInterval(gridPollTimerRef.current);
    };
  }, [isGridPolling, projectId]);

  // Auto-poll video clips (also start polling if there are pending/generating clips on page load)
  useEffect(() => {
    if (videoClips.data?.some((c: any) => c.status === "pending" || c.status === "generating" || c.status === "upsampling")) {
      if (!isPolling) setIsPolling(true);
    }
  }, [videoClips.data]);

  useEffect(() => {
    if (isPolling) {
      pollTimerRef.current = setInterval(() => {
        pollClipsMut.mutate({ projectId });
      }, 15000);
      // Immediate first poll after 3s delay
      const t = setTimeout(() => pollClipsMut.mutate({ projectId }), 3000);
      return () => { clearTimeout(t); if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isPolling, projectId]);

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

  const { project, script, anchors, grid, gridPages, panels, prompts } = data as any;

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

  // Build anchor prompt list for viewing
  const anchorPromptList = (anchors ?? []).map((a: any) => ({
    label: `${a.anchorType === "character" ? "角色" : a.anchorType === "scene" ? "场景" : "道具"}: ${a.name}`,
    text: a.prompt || a.description || "(无prompt)",
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/browse")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{project.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline">{project.duration}秒</Badge>
              <Badge variant={project.status === "confirmed" ? "default" : "secondary"}>
                {STATUS_MAP[project.status] || project.status}
              </Badge>
              <span className="text-xs text-muted-foreground">v{project.currentVersion}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-11 sm:ml-0">
          <Button variant="outline" size="sm" onClick={() => setHistoryDialogOpen(true)}>
            <History className="mr-1 sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">历史版本</span>
            <span className="sm:hidden">历史</span>
          </Button>
          {project.status !== "confirmed" && (
            <Button
              size="sm"
              variant="default"
              onClick={() => confirmProject.mutate({ id: projectId, status: "confirmed" })}
              disabled={confirmProject.isPending || !prompts?.length}
            >
              <CheckCircle className="mr-1 sm:mr-2 h-4 w-4" />
              确认
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">总览</TabsTrigger>
          <TabsTrigger value="script" className="text-xs sm:text-sm">脚本</TabsTrigger>
          <TabsTrigger value="anchor" className="text-xs sm:text-sm">Anchor</TabsTrigger>
          <TabsTrigger value="grid" className="text-xs sm:text-sm">Grid</TabsTrigger>
          <TabsTrigger value="prompts" className="text-xs sm:text-sm">Prompt</TabsTrigger>
          <TabsTrigger value="video" className="text-xs sm:text-sm">视频</TabsTrigger>
        </TabsList>

        {/* ==================== Overview Tab ==================== */}
        <TabsContent value="overview" className="space-y-4">
          {/* Workflow Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">工作流进度</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <WorkflowStep step={1} title="生成脚本" done={!!script} loading={generateScript.isPending}
                onView={() => setActiveTab("script")}
                onRegenerate={() => setConfirmRegenDialog({ step: "脚本", action: () => generateScript.mutate({ projectId }) })}
              />
              <WorkflowStep step={2} title="生成Anchor（锚点参考图）" done={!!(anchors && anchors.length > 0)} loading={generateAnchor.isPending}
                onView={() => setActiveTab("anchor")}
                onRegenerate={() => setConfirmRegenDialog({ step: "Anchor", action: () => generateAnchor.mutate({ projectId }) })}
                disabled={!script}
              />
              <WorkflowStep step={3} title="生成Grid（分镜图）" done={!!grid && project.status !== "grid_generating"} loading={generateGrid.isPending || isGridPolling || project.status === "grid_generating"}
                onView={() => setActiveTab("grid")}
                onRegenerate={() => setConfirmRegenDialog({ step: "Grid", action: () => generateGrid.mutate({ projectId }) })}
                disabled={!script}
              />
              <WorkflowStep step={4} title="审查与调整" done={project.status === "reviewing" || project.status === "confirmed"}
                onView={() => setActiveTab("grid")}
                onRegenerate={() => {
                  if (project.status !== "reviewing" && project.status !== "confirmed") {
                    confirmProject.mutate({ id: projectId, status: "reviewing" });
                    setActiveTab("grid");
                    toast.info("已进入审查模式，请在Grid页面检查每个面板并标记问题");
                  } else {
                    setActiveTab("grid");
                  }
                }}
                disabled={!grid}
                confirmLabel={project.status === "reviewing" ? "继续审查" : (project.status === "confirmed" ? "已完成" : "开始审查")}
              />
              <WorkflowStep step={5} title="生成Prompt" done={!!prompts?.length} loading={generatePrompts.isPending}
                onView={() => setActiveTab("prompts")}
                onRegenerate={() => setConfirmRegenDialog({ step: "Prompt", action: () => generatePrompts.mutate({ projectId }) })}
                disabled={!grid}
              />
              <WorkflowStep step={6} title="确认导出" done={project.status === "confirmed"}
                onView={() => {}}
                onRegenerate={() => confirmProject.mutate({ id: projectId, status: "confirmed" })}
                disabled={!prompts?.length} confirmLabel="确认"
              />
            </CardContent>
          </Card>

          {/* Script Summary + Grid Preview side by side */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Grid预览
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gridPages && gridPages.length > 0 && gridPages.some((gp: any) => gp.gridImageUrl) ? (
                  <div className="space-y-2">
                    {gridPages.length > 1 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <span className="font-medium">共 {gridPages.length} 页Grid</span>
                      </div>
                    )}
                    <img src={gridPages[0]?.gridImageUrl || grid?.gridImageUrl} alt="Storyboard Grid" className="w-full rounded-lg border" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>布局: {grid?.rows}×{grid?.cols}</span>
                      <span>·</span>
                      <span>v{grid?.version}</span>
                      {gridPages.length > 1 && <><span>·</span><span>{gridPages.length}页</span></>}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab("grid")}>
                      查看详情 →
                    </Button>
                  </div>
                ) : grid?.gridImageUrl ? (
                  <div className="space-y-2">
                    <img src={grid.gridImageUrl} alt="Storyboard Grid" className="w-full rounded-lg border" />
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

          {/* Anchors Preview */}
          {anchors && anchors.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  锚点参考图
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setPromptViewDialog({ title: "Anchor 生成 Prompt", prompts: anchorPromptList })}>
                  <FileText className="h-4 w-4 mr-1" />
                  <span className="text-xs">查看Prompt</span>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base">分镜脚本</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {script?.generationPrompt && (
                  <Button size="sm" variant="ghost" onClick={() => setPromptViewDialog({
                    title: "脚本生成 Prompt",
                    prompts: [{ label: "System Prompt", text: script.generationPrompt as string }],
                  })}>
                    <FileText className="h-4 w-4 mr-1" />
                    <span className="text-xs">查看Prompt</span>
                  </Button>
                )}
                {script && (
                  <Button size="sm" variant="outline" onClick={() => setAddFrameDialog({ afterIndex: scriptFrames.length })}>
                    <Plus className="h-4 w-4 mr-1" />
                    <span className="text-xs">添加镜头</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setConfirmRegenDialog({ step: "脚本", action: () => generateScript.mutate({ projectId }) })}
                  disabled={generateScript.isPending}
                >
                  {generateScript.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {script ? "重新生成" : "生成脚本"}
                </Button>
              </div>
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
                  {/* 30% Rule Validation */}
                  {validation30.data && validation30.data.totalViolations > 0 && (
                    <div className={`p-3 rounded-lg border ${
                      validation30.data.criticalCount > 0 ? 'border-red-500/50 bg-red-500/5' :
                      validation30.data.warningCount > 0 ? 'border-yellow-500/50 bg-yellow-500/5' :
                      'border-blue-500/50 bg-blue-500/5'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {validation30.data.criticalCount > 0 ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : validation30.data.warningCount > 0 ? (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <Info className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="text-sm font-medium">30% 法则检查</span>
                        <div className="flex gap-1 ml-auto">
                          {validation30.data.criticalCount > 0 && (
                            <Badge variant="destructive" className="text-[10px]">严重 {validation30.data.criticalCount}</Badge>
                          )}
                          {validation30.data.warningCount > 0 && (
                            <Badge className="text-[10px] bg-yellow-500">警告 {validation30.data.warningCount}</Badge>
                          )}
                          {validation30.data.infoCount > 0 && (
                            <Badge variant="secondary" className="text-[10px]">提示 {validation30.data.infoCount}</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{validation30.data.summary}</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {validation30.data.violations.map((v: any, vi: number) => (
                          <div key={vi} className={`text-xs p-2 rounded ${
                            v.severity === 'critical' ? 'bg-red-500/10 text-red-700 dark:text-red-300' :
                            v.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300' :
                            'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                          }`}>
                            <span className="font-medium">
                              {v.severity === 'critical' ? '🔴' : v.severity === 'warning' ? '🟡' : '🔵'}
                              {' '}#{v.frameA} → #{v.frameB}
                            </span>
                            <span className="ml-1">{v.reason}</span>
                            {v.details?.descriptionSimilarity > 0 && (
                              <span className="ml-1 opacity-70">(相似度: {(v.details.descriptionSimilarity * 100).toFixed(0)}%)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {validation30.data && validation30.data.totalViolations === 0 && (
                    <div className="p-3 rounded-lg border border-green-500/50 bg-green-500/5 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-700 dark:text-green-300">30% 法则检查通过 — 相邻镜头视觉差异充分</span>
                    </div>
                  )}
                  {/* Frames Table - Desktop */}
                  <div className="border rounded-lg overflow-hidden hidden sm:block">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left w-12">#</th>
                          <th className="px-3 py-2 text-left w-20">景别</th>
                          <th className="px-3 py-2 text-left w-16">时长</th>
                          <th className="px-3 py-2 text-left">描述</th>
                          <th className="px-3 py-2 text-left w-24">运镜</th>
                          <th className="px-3 py-2 text-left w-32">备注</th>
                          <th className="px-3 py-2 text-left w-28">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scriptFrames.map((f: any, i: number) => (
                          <tr key={i} className="border-t hover:bg-muted/20">
                            <td className="px-3 py-2 font-mono text-xs">{f.index || i + 1}</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-xs">{f.shotType || "-"}</Badge>
                            </td>
                            <td className="px-3 py-2 text-xs">{f.duration || "-"}s</td>
                            <td className="px-3 py-2 text-xs">{f.description || "-"}</td>
                            <td className="px-3 py-2 text-xs">{f.cameraMovement || f.cameraMove || "-"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{f.notes || "-"}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                                  onClick={() => setEditingFrame({ index: f.index || i + 1, data: { ...f } })}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                                  onClick={() => setAddFrameDialog({ afterIndex: f.index || i + 1 })}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteFrameDialog(f.index || i + 1)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Frames Cards - Mobile */}
                  <div className="sm:hidden space-y-2">
                    {scriptFrames.map((f: any, i: number) => (
                      <div key={i} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">#{f.index || i + 1}</Badge>
                            <Badge variant="secondary" className="text-xs">{f.shotType || "-"}</Badge>
                            <span className="text-xs text-muted-foreground">{f.duration || "-"}s</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => setEditingFrame({ index: f.index || i + 1, data: { ...f } })}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => setAddFrameDialog({ afterIndex: f.index || i + 1 })}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                              onClick={() => setDeleteFrameDialog(f.index || i + 1)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs">{f.description || "-"}</p>
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                          <span>运镜: {f.cameraMovement || f.cameraMove || "-"}</span>
                          {f.notes && <span>备注: {f.notes}</span>}
                        </div>
                      </div>
                    ))}
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
        </TabsContent>

        {/* ==================== Anchor Tab ==================== */}
        <TabsContent value="anchor" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base">锚点参考图 (Anchors)</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {anchors && anchors.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setPromptViewDialog({ title: "Anchor 生成 Prompt", prompts: anchorPromptList })}>
                    <FileText className="h-4 w-4 mr-1" />
                    <span className="text-xs">查看Prompt</span>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setAnchorLibImportDialog(true)}>
                  <Library className="mr-1 h-4 w-4" />
                  从库中导入
                </Button>
                <Button size="sm"
                  onClick={() => setConfirmRegenDialog({ step: "全部Anchor", action: () => generateAnchor.mutate({ projectId }) })}
                  disabled={generateAnchor.isPending || !script}
                >
                  {generateAnchor.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {anchors?.length ? "重新生成" : "生成Anchor"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {anchors && anchors.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {anchors.map((a: any) => (
                    <div key={a.id} className="space-y-2 group relative">
                      {a.imageUrl ? (
                        <img src={a.imageUrl} alt={a.name} className="w-full aspect-square object-cover rounded-lg border" />
                      ) : (
                        <div className="w-full aspect-square bg-muted/30 rounded-lg flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {a.anchorType === "character" ? "角色" : a.anchorType === "scene" ? "场景" : "道具"}
                        </Badge>
                        {a.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                        )}
                      </div>
                      {/* Per-anchor actions */}
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs"
                          onClick={() => setAnchorEditDialog({ anchor: a, customPrompt: a.prompt || "" })}>
                          <Pencil className="h-3 w-3 mr-1" />
                          编辑Prompt
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" title="导出到Anchor库"
                          onClick={() => setAnchorExportDialog({ anchor: a })}>
                          <Upload className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => setConfirmRegenDialog({
                            step: `Anchor "${a.name}"`,
                            action: () => regenerateOneAnchor.mutate({ anchorId: a.id }),
                          })}
                          disabled={regenerateOneAnchor.isPending}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Camera className="h-12 w-12 mb-4 opacity-30" />
                  <p>{script ? "点击\"生成Anchor\"开始" : "请先生成脚本"}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== Grid Tab ==================== */}
        <TabsContent value="grid" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base">分镜Grid</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {grid?.generationPrompt && (
                  <Button size="sm" variant="ghost" onClick={() => setPromptViewDialog({
                    title: "Grid 生成 Prompt",
                    prompts: [{ label: "图片生成Prompt", text: grid.generationPrompt as string }],
                  })}>
                    <FileText className="h-4 w-4 mr-1" />
                    <span className="text-xs">查看Prompt</span>
                  </Button>
                )}
                {/* 一键下载 Grid + Anchor */}
                {(grid?.gridImageUrl || (anchors && anchors.some((a: any) => a.imageUrl))) && (
                  <Button size="sm" variant="outline"
                    onClick={async () => {
                      try {
                        toast.info("正在打包下载...");
                        // Collect all image URLs
                        const files: { name: string; url: string }[] = [];
                        if (grid?.gridImageUrl) {
                          files.push({ name: `grid_${grid.rows}x${grid.cols}.png`, url: grid.gridImageUrl });
                        }
                        if (anchors) {
                          anchors.filter((a: any) => a.imageUrl).forEach((a: any) => {
                            const safeName = (a.name || "anchor").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_");
                            files.push({ name: `anchor_${safeName}.png`, url: a.imageUrl });
                          });
                        }
                        // Also include extracted panel images
                        if (panels) {
                          panels.filter((p: any) => p.panelImageUrl).forEach((p: any) => {
                            files.push({ name: `panel_${p.panelIndex}.png`, url: p.panelImageUrl });
                          });
                        }
                        if (files.length === 0) { toast.error("没有可下载的图片"); return; }
                        // If only one file, download directly
                        if (files.length === 1) {
                          const a = document.createElement("a");
                          a.href = files[0].url;
                          a.download = files[0].name;
                          a.target = "_blank";
                          a.click();
                          toast.success("下载已开始");
                          return;
                        }
                        // Multiple files: use backend proxy + JSZip to avoid CORS
                        try {
                          const JSZip = (await import("jszip")).default;
                          const zip = new JSZip();
                          const folder = zip.folder(`${project.title}_assets`) || zip;
                          // Use backend proxy to fetch images (avoids CORS)
                          const urls = files.map(f => f.url);
                          const proxyResults = await proxyImagesMut.mutateAsync({ urls });
                          let addedCount = 0;
                          proxyResults.forEach((r: any, i: number) => {
                            if (r.base64) {
                              const binary = atob(r.base64);
                              const bytes = new Uint8Array(binary.length);
                              for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                              folder.file(files[i].name, bytes);
                              addedCount++;
                            }
                          });
                          if (addedCount === 0) { toast.error("图片下载失败，请重试"); return; }
                          const zipBlob = await zip.generateAsync({ type: "blob" });
                          const url = URL.createObjectURL(zipBlob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${project.title}_assets_${new Date().toISOString().slice(0,10)}.zip`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success(`已打包 ${addedCount} 个文件`);
                        } catch (zipErr: any) {
                          console.error("ZIP download failed:", zipErr);
                          // Fallback: open files in new tabs
                          files.forEach((f, i) => {
                            setTimeout(() => window.open(f.url, "_blank"), i * 500);
                          });
                          toast.success(`正在逐个打开 ${files.length} 个文件`);
                        }
                      } catch (err: any) {
                        toast.error(`下载失败: ${err.message}`);
                      }
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    下载素材
                  </Button>
                )}
                {grid && panels && panels.length > 0 && (
                  <Button size="sm" variant="outline"
                    onClick={() => extractPanelsMut.mutate({ projectId })}
                    disabled={extractPanelsMut.isPending}
                  >
                    {extractPanelsMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    提取面板
                  </Button>
                )}
                {grid && panels && (() => {
                  const modifiedPanels = panels.filter((p: any) => p.status === 'fixed' || ((p.fixHistory as any[])?.length > 0));
                  if (modifiedPanels.length === 0) return null;
                  return (
                    <Button size="sm" variant="secondary"
                      onClick={() => setConfirmRegenDialog({
                        step: `Grid（基于 ${modifiedPanels.length} 个已修改面板重新合成）`,
                        action: () => regenerateGridFromPanels.mutate({ projectId }),
                      })}
                      disabled={regenerateGridFromPanels.isPending}
                    >
                      {regenerateGridFromPanels.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                      重新合成Grid ({modifiedPanels.length}个已修改)
                    </Button>
                  );
                })()}
                <Button size="sm"
                  onClick={() => setConfirmRegenDialog({ step: "Grid", action: () => generateGrid.mutate({ projectId }) })}
                  disabled={generateGrid.isPending || !script}
                >
                  {generateGrid.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {grid ? "重新生成" : "生成Grid"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const allPages = gridPages && gridPages.length > 0 ? gridPages : (grid ? [grid] : []);
                const hasImages = allPages.some((gp: any) => gp.gridImageUrl);
                if (!hasImages) {
                  if (project.status === "grid_generating" || isGridPolling) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="h-12 w-12 mb-4 animate-spin text-primary" />
                        <p className="text-lg font-medium">Grid生成中...</p>
                        <p className="text-sm mt-2">后台正在生成分镜图，请稍等（通常需要2-5分钟）</p>
                      </div>
                    );
                  }
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mb-4 opacity-30" />
                      <p>尚未生成Grid，请先生成脚本</p>
                    </div>
                  );
                }
                const currentPage = allPages[activeGridPage] || allPages[0];
                return (
                  <div className="space-y-4">
                    {/* Multi-page navigation */}
                    {allPages.length > 1 && (
                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                        <Button variant="ghost" size="sm" disabled={activeGridPage === 0}
                          onClick={() => setActiveGridPage(prev => Math.max(0, prev - 1))}>
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2">
                          {allPages.map((_: any, i: number) => (
                            <button key={i}
                              className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                                i === activeGridPage ? 'bg-primary text-primary-foreground' : 'bg-background border hover:bg-accent'
                              }`}
                              onClick={() => setActiveGridPage(i)}>
                              {i + 1}
                            </button>
                          ))}
                        </div>
                        <Button variant="ghost" size="sm" disabled={activeGridPage >= allPages.length - 1}
                          onClick={() => setActiveGridPage(prev => Math.min(allPages.length - 1, prev + 1))}>
                          <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Button>
                      </div>
                    )}
                    {/* Grid image */}
                    {currentPage?.gridImageUrl && (
                      <img src={currentPage.gridImageUrl} alt={`Storyboard Grid Page ${activeGridPage + 1}`} className="w-full rounded-lg border" />
                    )}
                    {/* Page info */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>布局: {currentPage?.rows}×{currentPage?.cols}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span>版本: v{currentPage?.version}</span>
                      {allPages.length > 1 && (
                        <>
                          <Separator orientation="vertical" className="h-4" />
                          <span>第 {activeGridPage + 1}/{allPages.length} 页</span>
                          {currentPage?.pageLabel && (
                            <>
                              <Separator orientation="vertical" className="h-4" />
                              <span className="text-xs">{currentPage.startFrame && currentPage.endFrame ? `帧 ${currentPage.startFrame}-${currentPage.endFrame}` : currentPage.pageLabel}</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Panel List */}
          {panels && panels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">面板列表（点击面板标记问题或修复）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {panels.map((p: any) => (
                    <div
                      key={p.id}
                      className={`relative rounded-lg border-2 p-2 cursor-pointer transition-all hover:shadow-md ${
                        selectedPanel === p.panelIndex ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}
                      onClick={() => { setSelectedPanel(p.panelIndex); setFixDialogOpen(true); }}
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
          <Dialog open={fixDialogOpen} onOpenChange={(open) => { setFixDialogOpen(open); if (!open) setSelectedRefImages([]); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>修复面板 #{selectedPanel}</DialogTitle>
                <DialogDescription>选择修复方式、参考图并提供修复指引</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Show current panel image - with mask canvas for inpaint mode */}
                {selectedPanel !== null && (() => {
                  const panel = panels?.find((p: any) => p.panelIndex === selectedPanel);
                  if (!panel?.panelImageUrl) return null;
                  return fixType === "inpaint" ? (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">在图上涂抹需要修复的区域</Label>
                      <MaskCanvas
                        imageUrl={panel.panelImageUrl}
                        onMaskChange={setMaskDataUrl}
                        width={480}
                        height={300}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">当前面板图</Label>
                      <img src={panel.panelImageUrl} alt={`Panel ${selectedPanel}`} className="w-full aspect-video object-cover rounded border" />
                    </div>
                  );
                })()}

                {/* Panel Prompt from Grid generation */}
                {selectedPanel !== null && (() => {
                  const panel = panels?.find((p: any) => p.panelIndex === selectedPanel);
                  const panelPrompt = prompts?.find((p: any) => {
                    const matchPanel = panels?.find((pan: any) => pan.id === p.panelId);
                    return matchPanel?.panelIndex === selectedPanel;
                  });
                  if (!panel?.description && !panelPrompt?.promptText) return null;
                  return (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">面板描述 & Prompt</Label>
                      <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-xs">
                        {panel?.description && (
                          <div>
                            <span className="font-medium text-muted-foreground">分镜描述：</span>
                            <span>{panel.description}</span>
                          </div>
                        )}
                        {panelPrompt?.promptText && (
                          <div>
                            <span className="font-medium text-muted-foreground">视频Prompt：</span>
                            <span className="text-primary/80">{panelPrompt.promptText}</span>
                          </div>
                        )}
                        {panel?.shotType && (
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-[10px]">{panel.shotType}</Badge>
                            {panel.cameraMovement && <Badge variant="outline" className="text-[10px]">{panel.cameraMovement}</Badge>}
                            {panel.duration && <Badge variant="outline" className="text-[10px]">{panel.duration}s</Badge>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Reference Images Section - Anchors + Original Panel + Other Frames */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">参考图（点击选择/取消，选中的图会作为修复参考）</Label>
                  
                  {/* Anchor references */}
                  {anchors && anchors.filter((a: any) => a.imageUrl).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium">Anchor参考图（自动引用）</p>
                      <div className="flex gap-2 overflow-x-auto">
                        {anchors.filter((a: any) => a.imageUrl).map((a: any) => (
                          <div key={a.id} className="shrink-0 text-center">
                            <img src={a.imageUrl} alt={a.name} className="h-16 w-16 object-cover rounded border border-primary/30" />
                            <p className="text-[10px] mt-0.5">{a.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other frames as reference (clickable to select) */}
                  {panels && panels.filter((p: any) => p.panelImageUrl && p.panelIndex !== selectedPanel).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium">其他帧（点击选择作为参考）</p>
                      <div className="flex gap-2 overflow-x-auto">
                        {panels.filter((p: any) => p.panelImageUrl && p.panelIndex !== selectedPanel).map((p: any) => {
                          const isSelected = selectedRefImages.includes(p.panelImageUrl);
                          return (
                            <div key={p.id} className="shrink-0 text-center cursor-pointer" onClick={() => {
                              setSelectedRefImages(prev => 
                                isSelected ? prev.filter(url => url !== p.panelImageUrl) : [...prev, p.panelImageUrl]
                              );
                            }}>
                              <img src={p.panelImageUrl} alt={`Panel ${p.panelIndex}`} 
                                className={`h-16 w-24 object-cover rounded border-2 transition-all ${
                                  isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                                }`} />
                              <p className="text-[10px] mt-0.5">#{p.panelIndex} {p.shotType || ""}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {selectedRefImages.length > 0 && (
                    <p className="text-[10px] text-primary">已选择 {selectedRefImages.length} 张参考图</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>问题描述</Label>
                  <Textarea placeholder="描述这个面板的问题..." value={issueText} onChange={(e) => setIssueText(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>修复方式</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { value: "inpaint" as const, label: "局部修复", icon: Pencil },
                      { value: "regenerate" as const, label: "重新生成", icon: RefreshCw },
                      { value: "reference" as const, label: "参考图生成", icon: ImageIcon },
                    ].map((opt) => (
                      <Button key={opt.value} variant={fixType === opt.value ? "default" : "outline"} className="flex flex-col h-auto py-3"
                        onClick={() => setFixType(opt.value)}>
                        <opt.icon className="h-4 w-4 mb-1" />
                        <span className="text-xs">{opt.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>修复提示词</Label>
                  <Textarea placeholder="输入修复的具体要求..." value={fixPrompt} onChange={(e) => setFixPrompt(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setFixDialogOpen(false); setSelectedRefImages([]); }}>取消</Button>
                <Button
                  onClick={() => {
                    if (selectedPanel === null) return;
                    const panel = panels?.find((p: any) => p.panelIndex === selectedPanel);
                    if (panel) {
                      fixPanelMut.mutate({
                        panelId: panel.id,
                        fixType: fixType === "reference" ? "reference_based" : fixType,
                        modifiedDescription: fixPrompt || undefined,
                        maskDataUrl: fixType === "inpaint" ? maskDataUrl || undefined : undefined,
                        referenceImageUrls: selectedRefImages.length > 0 ? selectedRefImages : undefined,
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
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base">视频生成Prompt</CardTitle>
              <div className="flex items-center gap-2">
                {prompts && prompts.length > 0 && (
                  <>
                  <Select onValueChange={(strategy) => {
                    if (!prompts || !panels) return;
                    const exportData = prompts.map((p: any, idx: number) => {
                      const matchingPanel = panels.find((pan: any) => pan.id === p.panelId);
                      const displayIndex = matchingPanel?.panelIndex ?? (idx + 1);
                      const matchingFrame = scriptFrames.find((f: any) => f.index === displayIndex);
                      return {
                        panelIndex: displayIndex,
                        promptText: p.promptText || "",
                        negativePrompt: p.negativePrompt || "",
                        shotType: p.shotType || "",
                        cameraAngle: p.cameraAngle || "",
                        subject: p.subject || "",
                        action: p.action || "",
                        cameraMovement: p.cameraMovement || "",
                        lighting: p.lighting || "",
                        texture: p.texture || "",
                        effects: p.effects || "",
                        transition: p.transition || "",
                        duration: matchingPanel?.duration || matchingFrame?.duration || 2,
                      };
                    }).sort((a: any, b: any) => a.panelIndex - b.panelIndex);
                    const anchorRefs = anchors?.filter((a: any) => a.imageUrl).map((a: any, i: number) => `@图片${i + 2}(${a.name})`).join("、") || "";
                    const gridRef = `@图片1`;
                    const gridSize = `${grid?.rows || 2}×${grid?.cols || 3}`;
                    const totalDuration = exportData.reduce((sum: number, d: any) => sum + (parseFloat(d.duration) || 2), 0);

                    // Helper: build prompt text for a subset of panels
                    const buildPromptForPanels = (panelData: any[], segIdx?: number, totalSegs?: number) => {
                      let text = "";
                      const segLabel = totalSegs && totalSegs > 1 ? `（第${segIdx}/${totalSegs}段）` : "";
                      if (strategy === "s1") {
                        text = `参考${gridRef}的${gridSize}宫格分镜图${segLabel}，制作成连续的视频，注意分镜编排。`;
                        if (totalSegs && totalSegs > 1) text += `\n本段包含镜头${panelData[0].panelIndex}-${panelData[panelData.length-1].panelIndex}。`;
                        if (anchorRefs) text += `\n角色参考：${anchorRefs}。`;
                      } else if (strategy === "s2") {
                        text = `参考${gridRef}的分镜脚本${segLabel}，借鉴其中的分镜、景别、运镜、画面和文案。`;
                        if (anchorRefs) text += `\n角色参考：${anchorRefs}，保持角色外观、服装、场景的一致性。`;
                        const segDuration = panelData.reduce((s: number, d: any) => s + (parseFloat(d.duration) || 2), 0);
                        text += `\n制作${segDuration}秒短片。`;
                        if (totalSegs && totalSegs > 1) text += `镜头范围：${panelData[0].panelIndex}-${panelData[panelData.length-1].panelIndex}。`;
                      } else if (strategy === "s3") {
                        text = `参考${gridRef}的${gridSize}宫格分镜图${segLabel}，按从左到右、从上到下的顺序，依次还原每个分镜的画面内容。`;
                        if (anchorRefs) text += `\n角色参考：${anchorRefs}，保持角色外观、服装、场景的一致性。`;
                        text += `\n分镜详情：`;
                        panelData.forEach((d: any) => {
                          const actionDesc = d.action || d.promptText.slice(0, 60);
                          const cam = d.cameraMovement && d.cameraMovement !== "固定" ? `，${d.cameraMovement}` : "";
                          text += `\n镜头${d.panelIndex}：${actionDesc}${cam}`;
                        });
                      } else if (strategy === "s4") {
                        text = `参考${gridRef}的${gridSize}宫格分镜图${segLabel}，按从左到右、从上到下的顺序，依次还原每个分镜的画面内容。`;
                        if (anchorRefs) text += `\n角色参考：${anchorRefs}，保持角色外观、服装、场景的一致性。`;
                        text += `\n分镜详情：`;
                        panelData.forEach((d: any) => {
                          const parts = [
                            d.subject || "",
                            d.action || "",
                            [d.shotType, d.cameraMovement, d.cameraAngle].filter(Boolean).join(", "),
                            d.lighting || "",
                            d.texture || d.effects || "",
                          ].filter(Boolean);
                          text += `\n镜头${d.panelIndex}：${parts.join("。")}`;
                        });
                        text += `\nCinematic, 4K, realistic lighting.`;
                      } else if (strategy === "s5") {
                        text = `参考${gridRef}的${gridSize}宫格分镜图${segLabel}，按从左到右、从上到下的顺序，依次还原每个分镜的画面内容。`;
                        if (anchorRefs) text += `\n角色参考：${anchorRefs}，保持角色外观、服装、场景的一致性。`;
                        text += `\n分镜详情：`;
                        panelData.forEach((d: any) => {
                          const shotTag = [d.shotType, d.cameraAngle].filter(Boolean).join(", ");
                          const camTag = d.cameraMovement || "";
                          text += `\n镜头${d.panelIndex}：${shotTag ? shotTag + ", " : ""}${d.promptText}${camTag ? `（${camTag}）` : ""}`;
                        });
                        text += `\nHigh contrast, cinematic texture, smooth and seamless transitions, vivid characters.`;
                      } else if (strategy === "s6") {
                        text = `参考${gridRef}的${gridSize}宫格分镜图${segLabel}。`;
                        if (anchorRefs) text += `角色参考：${anchorRefs}。`;
                        const narrative = panelData.map((d: any) => {
                          return d.action || d.promptText.split("。")[0];
                        }).join("；");
                        text += `\n${narrative}。`;
                        text += `\n高对比度，电影质感，丝滑转场。`;
                      }
                      return text;
                    };

                    // Check if we need segmentation (total > 15s)
                    if (totalDuration <= 15) {
                      // Single segment - copy directly
                      const text = buildPromptForPanels(exportData);
                      navigator.clipboard.writeText(text).then(() => {
                        toast.success(`已复制「${["极简意图","官方R2V","动作驱动","五要素结构","完整分镜","叙事连贯"][parseInt(strategy.slice(1))-1]}」策略到剪贴板 (${totalDuration}s)`);
                      }).catch(() => {
                        const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
                        toast.success(`已复制到剪贴板`);
                      });
                    } else {
                      // Split into segments of <=15s each
                      const segments: Array<{ index: number; startPanel: number; endPanel: number; totalDuration: number; panels: any[]; text: string }> = [];
                      let currentSegment: any[] = [];
                      let currentDuration = 0;
                      let segIdx = 1;

                      // First pass: group panels into segments
                      const tempSegments: any[][] = [];
                      for (const d of exportData) {
                        const dur = parseFloat(d.duration) || 2;
                        if (currentDuration + dur > 15 && currentSegment.length > 0) {
                          tempSegments.push([...currentSegment]);
                          currentSegment = [d];
                          currentDuration = dur;
                        } else {
                          currentSegment.push(d);
                          currentDuration += dur;
                        }
                      }
                      if (currentSegment.length > 0) tempSegments.push(currentSegment);

                      const totalSegs = tempSegments.length;
                      for (const seg of tempSegments) {
                        const segDur = seg.reduce((s: number, d: any) => s + (parseFloat(d.duration) || 2), 0);
                        segments.push({
                          index: segIdx,
                          startPanel: seg[0].panelIndex,
                          endPanel: seg[seg.length - 1].panelIndex,
                          totalDuration: segDur,
                          panels: seg,
                          text: buildPromptForPanels(seg, segIdx, totalSegs),
                        });
                        segIdx++;
                      }

                      setSegmentedExportDialog({ segments, strategy: ["极简意图","官方R2V","动作驱动","五要素结构","完整分镜","叙事连贯"][parseInt(strategy.slice(1))-1] });
                    }
                  }}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>复制Seedance Prompt</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="s1">策略1: 极简意图</SelectItem>
                      <SelectItem value="s2">策略2: 官方R2V格式</SelectItem>
                      <SelectItem value="s3">策略3: 动作驱动</SelectItem>
                      <SelectItem value="s4">策略4: 五要素结构</SelectItem>
                      <SelectItem value="s5">策略5: 完整分镜描述</SelectItem>
                      <SelectItem value="s6">策略6: 叙事连贯体</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select onValueChange={(format) => {
                    if (!prompts || !panels) return;
                    const exportData = prompts.map((p: any, idx: number) => {
                      const matchingPanel = panels.find((pan: any) => pan.id === p.panelId);
                      const displayIndex = matchingPanel?.panelIndex ?? (idx + 1);
                      return {
                        panelIndex: displayIndex,
                        promptText: p.promptText || "",
                        negativePrompt: p.negativePrompt || "",
                        model: p.model || "auto",
                        controlStrategy: p.controlStrategy || "first_frame",
                        shotType: p.shotType || "",
                        cameraAngle: p.cameraAngle || "",
                        subject: p.subject || "",
                        action: p.action || "",
                        cameraMovement: p.cameraMovement || "",
                        lighting: p.lighting || "",
                        texture: p.texture || "",
                        effects: p.effects || "",
                        transition: p.transition || "",
                        firstFrameUrl: p.firstFrameUrl || "",
                      };
                    });
                    let content = "";
                    let filename = "";
                    let mimeType = "";
                    if (format === "json") {
                      content = JSON.stringify(exportData, null, 2);
                      filename = `prompts_${project.title}_${new Date().toISOString().slice(0,10)}.json`;
                      mimeType = "application/json";
                    } else if (format === "csv") {
                      const headers = Object.keys(exportData[0]);
                      const csvRows = [headers.join(",")];
                      exportData.forEach((row: any) => {
                        csvRows.push(headers.map(h => {
                          const val = String(row[h] || "").replace(/"/g, '""');
                          return val.includes(",") || val.includes('"') || val.includes("\n") ? `"${val}"` : val;
                        }).join(","));
                      });
                      content = csvRows.join("\n");
                      filename = `prompts_${project.title}_${new Date().toISOString().slice(0,10)}.csv`;
                      mimeType = "text/csv";
                    } else if (format === "txt") {
                      content = exportData.map((d: any) => {
                        const lines = [`=== Panel #${d.panelIndex} ===`];
                        lines.push(`Prompt: ${d.promptText}`);
                        if (d.negativePrompt) lines.push(`Negative: ${d.negativePrompt}`);
                        lines.push(`Model: ${d.model} | Strategy: ${d.controlStrategy}`);
                        const meta = [d.shotType, d.cameraAngle, d.cameraMovement, d.lighting, d.transition].filter(Boolean);
                        if (meta.length) lines.push(`Meta: ${meta.join(" | ")}`);
                        if (d.firstFrameUrl) lines.push(`First Frame: ${d.firstFrameUrl}`);
                        return lines.join("\n");
                      }).join("\n\n");
                      filename = `prompts_${project.title}_${new Date().toISOString().slice(0,10)}.txt`;
                      mimeType = "text/plain";
                    }
                    const blob = new Blob([content], { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success(`已导出 ${exportData.length} 条Prompt (${format.toUpperCase()})`);
                  }}>
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <div className="flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" />
                        <span>导出文件</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">导出 JSON</SelectItem>
                      <SelectItem value="csv">导出 CSV</SelectItem>
                      <SelectItem value="txt">导出 TXT</SelectItem>
                    </SelectContent>
                  </Select>
                  </>
                )}
                <Button size="sm"
                  onClick={() => setConfirmRegenDialog({ step: "Prompt", action: () => generatePrompts.mutate({ projectId }) })}
                  disabled={generatePrompts.isPending || !grid}
                >
                  {generatePrompts.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  {prompts?.length ? "重新生成" : "生成Prompt"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {prompts && prompts.length > 0 ? (
                <div className="space-y-3">
                  {prompts.map((p: any, idx: number) => {
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

        {/* ==================== Video Tab ==================== */}
        <TabsContent value="video" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5" />
                  视频生成
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={videoModel} onValueChange={setVideoModel}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doubao-seedance-1-5-pro-251215">Seedance 1.5 Pro</SelectItem>
                      <SelectItem value="veo3.1-fast">VEO 3.1 Fast</SelectItem>
                      <SelectItem value="veo3.1">VEO 3.1</SelectItem>
                      <SelectItem value="veo3-fast">VEO 3.0 Fast</SelectItem>
                      <SelectItem value="veo3">VEO 3.0</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => generateClipsMut.mutate({ projectId, model: videoModel })}
                    disabled={generateClipsMut.isPending || !panels?.length}
                  >
                    {generateClipsMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    生成视频Clips
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Clip Status Grid */}
              {videoClips.data && videoClips.data.length > 0 ? (
                (() => {
                  const allClips = videoClips.data as any[];
                  const activeClips = allClips.filter((c: any) => c.status !== "failed");
                  const failedClips = allClips.filter((c: any) => c.status === "failed");
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="text-sm font-medium">视频Clips ({activeClips.length}活跃{failedClips.length > 0 ? ` / ${failedClips.length}失败` : ""})</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          {isPolling && (
                            <Badge variant="outline" className="animate-pulse">
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              轮询中...
                            </Badge>
                          )}
                          <Button size="sm" variant="outline" onClick={() => pollClipsMut.mutate({ projectId })} disabled={pollClipsMut.isPending}>
                            <RefreshCw className="mr-1 h-3 w-3" />
                            刷新状态
                          </Button>
                          {failedClips.length > 0 && (
                            <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => clearFailedClipsMut.mutate({ projectId })} disabled={clearFailedClipsMut.isPending}>
                              <Trash2 className="mr-1 h-3 w-3" />
                              清除失败({failedClips.length})
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-muted-foreground" onClick={() => { if (confirm("确定清除所有Clips？")) clearAllClipsMut.mutate({ projectId }); }} disabled={clearAllClipsMut.isPending}>
                            <Trash2 className="mr-1 h-3 w-3" />
                            清除全部
                          </Button>
                        </div>
                      </div>

                      {/* Active clips (non-failed) */}
                      {activeClips.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {activeClips.map((clip: any) => (
                            <Card key={clip.id} className="overflow-hidden">
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">Panel #{clip.panelIndex}</span>
                                  <Badge variant={
                                    clip.status === "completed" ? "default" :
                                    "secondary"
                                  }>
                                    {clip.status === "completed" ? "✓ 完成" :
                                     clip.status === "generating" ? "生成中..." :
                                     clip.status === "upsampling" ? "超分中..." :
                                     clip.status === "pending" ? "排队中..." :
                                     clip.status}
                                  </Badge>
                                </div>
                                {clip.clipUrl && (
                                  <video
                                    src={clip.clipUrl}
                                    controls
                                    className="w-full aspect-video rounded bg-black"
                                    preload="metadata"
                                  />
                                )}
                                {!clip.clipUrl && (
                                  <div className="w-full aspect-video rounded bg-muted flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground truncate" title={clip.prompt}>
                                  {clip.prompt?.substring(0, 80)}...
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}

                      {/* Failed clips (collapsible) */}
                      {failedClips.length > 0 && (
                        <div className="border border-destructive/20 rounded-lg">
                          <button
                            className="w-full flex items-center justify-between p-3 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                            onClick={() => setShowFailedClips(!showFailedClips)}
                          >
                            <span className="flex items-center gap-2">
                              <X className="h-4 w-4" />
                              {failedClips.length} 个失败的Clip
                            </span>
                            <span className="text-xs">{showFailedClips ? "收起" : "展开查看"}</span>
                          </button>
                          {showFailedClips && (
                            <div className="p-3 pt-0 space-y-2">
                              {failedClips.map((clip: any) => (
                                <div key={clip.id} className="p-2 rounded bg-destructive/5 border border-destructive/10">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium">Panel #{clip.panelIndex}</span>
                                    <Badge variant="destructive" className="text-[10px] h-5">失败</Badge>
                                  </div>
                                  {clip.errorMessage && (
                                    <p className="text-[11px] text-destructive/80 break-all line-clamp-3">{clip.errorMessage}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Merge Button */}
                      {activeClips.some((c: any) => c.status === "completed") && (
                        <div className="flex items-center justify-center pt-4 border-t">
                          <Button
                            size="lg"
                            onClick={() => mergeClipsMut.mutate({ projectId })}
                            disabled={mergeClipsMut.isPending}
                          >
                            {mergeClipsMut.isPending ? (
                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />合并中...</>
                            ) : (
                              <><Film className="mr-2 h-4 w-4" />合并所有Clips为最终视频</>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  {panels?.length ? "点击“生成视频Clips”开始" : "请先完成Grid和Panel生成"}
                </p>
              )}

              {/* Final Video Section */}
              {finalVideos.data && finalVideos.data.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-medium">最终视频</h3>
                  {finalVideos.data.map((fv: any) => (
                    <Card key={fv.id} className="overflow-hidden">
                      <CardContent className="p-4 space-y-3">
                        {fv.videoUrl ? (
                          <video
                            src={fv.videoUrl}
                            controls
                            className="w-full aspect-video rounded bg-black"
                            preload="metadata"
                          />
                        ) : (
                          <div className="w-full aspect-video rounded bg-muted flex items-center justify-center">
                            <p className="text-muted-foreground">视频处理中...</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{fv.clipCount} 个clips</span>
                            {fv.totalDuration && <span>{parseFloat(fv.totalDuration).toFixed(1)}秒</span>}
                            {fv.confirmedAt && <Badge variant="default">✓ 已确认</Badge>}
                          </div>
                          {fv.videoUrl && !fv.confirmedAt && (
                            <Button
                              onClick={() => confirmFinalMut.mutate({ projectId })}
                              disabled={confirmFinalMut.isPending}
                            >
                              {confirmFinalMut.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="mr-2 h-4 w-4" />
                              )}
                              确认完成
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
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
            <Button onClick={() => { confirmRegenDialog?.action(); setConfirmRegenDialog(null); }}>
              确认重新生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Prompt View Dialog ==================== */}
      <Dialog open={!!promptViewDialog} onOpenChange={(open) => !open && setPromptViewDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {promptViewDialog?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {promptViewDialog?.prompts.map((p, i) => (
              <div key={i} className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{p.label}</p>
                <div className="bg-muted/50 rounded-lg p-3">
                  <pre className="text-xs whitespace-pre-wrap break-words font-mono">{p.text}</pre>
                </div>
              </div>
            ))}
          </div>
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
            <div>
              <p className="text-sm font-medium mb-2">脚本版本</p>
              {versionHistory.data?.scriptVersions?.length ? (
                <div className="space-y-1.5">
                  {versionHistory.data.scriptVersions.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2 rounded border text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={v.version === project.currentVersion ? "default" : "outline"} className="text-xs">v{v.version}</Badge>
                        <span className="text-muted-foreground">{v.createdAt ? new Date(v.createdAt).toLocaleString() : "-"}</span>
                        {v.validationPassed != null && (
                          <Badge variant={v.validationPassed ? "default" : "secondary"} className="text-[10px]">
                            {v.validationPassed ? "校验通过" : "未通过"}
                          </Badge>
                        )}
                      </div>
                      {v.version !== project.currentVersion && (
                        <Button size="sm" variant="ghost" className="h-6 text-xs"
                          onClick={() => { setHistoryDialogOpen(false); setRollbackDialog({ version: v.version }); }}>
                          <RotateCcw className="h-3 w-3 mr-1" />回退
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">暂无版本</p>}
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Grid版本</p>
              {versionHistory.data?.gridVersions?.length ? (
                <div className="space-y-1.5">
                  {versionHistory.data.gridVersions.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2 rounded border text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={v.version === project.currentVersion ? "default" : "outline"} className="text-xs">v{v.version}</Badge>
                        <span className="text-muted-foreground">{v.createdAt ? new Date(v.createdAt).toLocaleString() : "-"}</span>
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
            <div>
              <p className="text-sm font-medium mb-2">Prompt版本</p>
              {versionHistory.data?.promptVersions?.length ? (
                <div className="space-y-1.5">
                  {versionHistory.data.promptVersions.map((v: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded border text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={v.version === project.currentVersion ? "default" : "outline"} className="text-xs">v{v.version}</Badge>
                        <span className="text-muted-foreground">{v.createdAt ? new Date(v.createdAt).toLocaleString() : "-"}</span>
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
            <Button variant="destructive"
              onClick={() => { if (rollbackDialog) rollbackMut.mutate({ projectId, targetVersion: rollbackDialog.version }); }}
              disabled={rollbackMut.isPending}
            >
              {rollbackMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              确认回退
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Edit Frame Dialog ==================== */}
      <Dialog open={!!editingFrame} onOpenChange={(open) => !open && setEditingFrame(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑镜头 #{editingFrame?.index}</DialogTitle>
            <DialogDescription>修改镜头参数后保存</DialogDescription>
          </DialogHeader>
          {editingFrame && (
            <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>景别</Label>
                    <Select value={editingFrame.data.shotType || "中景"} onValueChange={(v) => setEditingFrame({ ...editingFrame, data: { ...editingFrame.data, shotType: v } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHOT_TYPES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>时长 (秒)</Label>
                    <Input type="number" step="0.5" min="0.5" max="10"
                      value={editingFrame.data.duration || 2}
                      onChange={(e) => setEditingFrame({ ...editingFrame, data: { ...editingFrame.data, duration: parseFloat(e.target.value) || 2 } })}
                    />
                  </div>
                </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea value={editingFrame.data.description || ""}
                  onChange={(e) => setEditingFrame({ ...editingFrame, data: { ...editingFrame.data, description: e.target.value } })}
                  rows={3}
                />
              </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>运镜</Label>
                    <Select value={editingFrame.data.cameraMovement || editingFrame.data.cameraMove || "固定"}
                      onValueChange={(v) => setEditingFrame({ ...editingFrame, data: { ...editingFrame.data, cameraMovement: v } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CAMERA_MOVES.map((cm) => <SelectItem key={cm} value={cm}>{cm}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>备注</Label>
                    <Input value={editingFrame.data.notes || ""}
                      onChange={(e) => setEditingFrame({ ...editingFrame, data: { ...editingFrame.data, notes: e.target.value } })}
                    />
                  </div>
                </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFrame(null)}>取消</Button>
            <Button onClick={() => {
              if (!editingFrame) return;
              updateFrame.mutate({
                projectId,
                frameIndex: editingFrame.index,
                data: {
                  shotType: editingFrame.data.shotType,
                  duration: editingFrame.data.duration,
                  description: editingFrame.data.description,
                  cameraMovement: editingFrame.data.cameraMovement,
                  notes: editingFrame.data.notes,
                },
              });
            }} disabled={updateFrame.isPending}>
              {updateFrame.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Add Frame Dialog ==================== */}
      <Dialog open={!!addFrameDialog} onOpenChange={(open) => !open && setAddFrameDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加新镜头</DialogTitle>
            <DialogDescription>
              将在第 {addFrameDialog?.afterIndex || 0} 帧之后插入新镜头
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>景别</Label>
                <Select value={newFrame.shotType} onValueChange={(v) => setNewFrame({ ...newFrame, shotType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHOT_TYPES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>时长 (秒)</Label>
                <Input type="number" step="0.5" min="0.5" max="10"
                  value={newFrame.duration}
                  onChange={(e) => setNewFrame({ ...newFrame, duration: parseFloat(e.target.value) || 2 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea value={newFrame.description} onChange={(e) => setNewFrame({ ...newFrame, description: e.target.value })} rows={3} placeholder="描述这个镜头的内容..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>运镜</Label>
                <Select value={newFrame.cameraMovement} onValueChange={(v) => setNewFrame({ ...newFrame, cameraMovement: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMERA_MOVES.map((cm) => <SelectItem key={cm} value={cm}>{cm}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>备注</Label>
                <Input value={newFrame.notes} onChange={(e) => setNewFrame({ ...newFrame, notes: e.target.value })} placeholder="可选" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFrameDialog(null)}>取消</Button>
            <Button onClick={() => {
              if (!addFrameDialog || !newFrame.description) { toast.error("请填写描述"); return; }
              addFrame.mutate({
                projectId,
                afterIndex: addFrameDialog.afterIndex,
                frame: newFrame,
              });
            }} disabled={addFrame.isPending}>
              {addFrame.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Delete Frame Confirm Dialog ==================== */}
      <Dialog open={deleteFrameDialog !== null} onOpenChange={(open) => !open && setDeleteFrameDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除镜头</DialogTitle>
            <DialogDescription>
              确定要删除第 {deleteFrameDialog} 帧吗？删除后后续帧会自动重新编号。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFrameDialog(null)}>取消</Button>
            <Button variant="destructive" onClick={() => {
              if (deleteFrameDialog !== null) removeFrame.mutate({ projectId, frameIndex: deleteFrameDialog });
            }} disabled={removeFrame.isPending}>
              {removeFrame.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Anchor Edit Prompt Dialog ==================== */}
      <Dialog open={!!anchorEditDialog} onOpenChange={(open) => !open && setAnchorEditDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑Anchor Prompt: {anchorEditDialog?.anchor?.name}</DialogTitle>
            <DialogDescription>修改prompt后重新生成该Anchor图片</DialogDescription>
          </DialogHeader>
          {anchorEditDialog && (
            <div className="space-y-4 py-2">
              {anchorEditDialog.anchor.imageUrl && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">当前图片</Label>
                  <img src={anchorEditDialog.anchor.imageUrl} alt={anchorEditDialog.anchor.name}
                    className="w-32 h-32 object-cover rounded-lg border" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Prompt</Label>
                <Textarea
                  value={anchorEditDialog.customPrompt}
                  onChange={(e) => setAnchorEditDialog({ ...anchorEditDialog, customPrompt: e.target.value })}
                  rows={6}
                  placeholder="输入自定义的图片生成prompt..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnchorEditDialog(null)}>取消</Button>
            <Button onClick={() => {
              if (!anchorEditDialog) return;
              regenerateOneAnchor.mutate({
                anchorId: anchorEditDialog.anchor.id,
                customPrompt: anchorEditDialog.customPrompt || undefined,
              });
            }} disabled={regenerateOneAnchor.isPending}>
              {regenerateOneAnchor.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              重新生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Anchor Library Import Dialog ==================== */}
      <Dialog open={anchorLibImportDialog} onOpenChange={(open) => { if (!open) { setAnchorLibImportDialog(false); setSelectedLibAnchors([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>从Anchor库导入</DialogTitle>
            <DialogDescription>选择要导入到当前项目的Anchor</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="搜索Anchor..."
                value={anchorLibSearch}
                onChange={(e) => setAnchorLibSearch(e.target.value)}
                className="flex-1"
              />
              <Select value={anchorLibTypeFilter} onValueChange={setAnchorLibTypeFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="character">角色</SelectItem>
                  <SelectItem value="scene">场景</SelectItem>
                  <SelectItem value="prop">道具</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {anchorLibQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : anchorLibQuery.data?.items && anchorLibQuery.data.items.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {anchorLibQuery.data.items.map((item: any) => {
                  const isSelected = selectedLibAnchors.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`relative cursor-pointer rounded-lg border-2 p-2 transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-transparent hover:border-muted-foreground/20"
                      }`}
                      onClick={() => {
                        setSelectedLibAnchors(prev =>
                          isSelected ? prev.filter(id => id !== item.id) : [...prev, item.id]
                        );
                      }}
                    >
                      {isSelected && (
                        <div className="absolute top-1 right-1 z-10 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full aspect-square object-cover rounded-md" />
                      ) : (
                        <div className="w-full aspect-square bg-muted/30 rounded-md flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <p className="text-xs font-medium truncate mt-1">{item.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">
                          {item.anchorType === "character" ? "角色" : item.anchorType === "scene" ? "场景" : "道具"}
                        </Badge>
                        {item.style && <Badge variant="secondary" className="text-[10px]">{item.style}</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Library className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Anchor库为空，请先在Anchor库页面创建</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <div className="flex items-center gap-2 w-full justify-between">
              <span className="text-sm text-muted-foreground">已选择 {selectedLibAnchors.length} 个</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setAnchorLibImportDialog(false); setSelectedLibAnchors([]); }}>取消</Button>
                <Button
                  onClick={() => importFromLibrary.mutate({ projectId, libraryItemIds: selectedLibAnchors })}
                  disabled={selectedLibAnchors.length === 0 || importFromLibrary.isPending}
                >
                  {importFromLibrary.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Library className="mr-2 h-4 w-4" />}
                  导入 ({selectedLibAnchors.length})
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Anchor Export to Library Dialog ==================== */}
      <Dialog open={!!anchorExportDialog} onOpenChange={(open) => { if (!open) { setAnchorExportDialog(null); setExportTags(""); setExportStyle(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>导出到Anchor库</DialogTitle>
            <DialogDescription>将 "{anchorExportDialog?.anchor?.name}" 保存到全局Anchor库</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {anchorExportDialog?.anchor?.imageUrl && (
              <img src={anchorExportDialog.anchor.imageUrl} alt={anchorExportDialog.anchor.name}
                className="w-24 h-24 object-cover rounded-lg border mx-auto" />
            )}
            <div className="space-y-2">
              <Label>风格标签</Label>
              <Input
                value={exportStyle}
                onChange={(e) => setExportStyle(e.target.value)}
                placeholder="例如：赛博朋克、水墨风、写实..."
              />
            </div>
            <div className="space-y-2">
              <Label>标签（逗号分隔）</Label>
              <Input
                value={exportTags}
                onChange={(e) => setExportTags(e.target.value)}
                placeholder="例如：武侠,古装,男性角色"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnchorExportDialog(null)}>取消</Button>
            <Button
              onClick={() => {
                if (!anchorExportDialog) return;
                exportToLibrary.mutate({
                  anchorId: anchorExportDialog.anchor.id,
                  style: exportStyle || undefined,
                  tags: exportTags ? exportTags.split(",").map((t: string) => t.trim()).filter(Boolean) : undefined,
                });
              }}
              disabled={exportToLibrary.isPending}
            >
              {exportToLibrary.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              导出到库
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Segmented Export Dialog ==================== */}
      <Dialog open={!!segmentedExportDialog} onOpenChange={(open) => !open && setSegmentedExportDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>分段导出 Seedance Prompt</DialogTitle>
            <DialogDescription>
              总时长超过15s，Seedance最多支持15s，已自动分成 {segmentedExportDialog?.segments.length} 段。
              策略：{segmentedExportDialog?.strategy}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {segmentedExportDialog?.segments.map((seg) => (
              <div key={seg.index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-sm">第 {seg.index} 段</Badge>
                    <span className="text-sm text-muted-foreground">
                      镜头 {seg.startPanel}-{seg.endPanel} · {seg.panels.length}个镜头 · {seg.totalDuration}s
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(seg.text).then(() => {
                      toast.success(`已复制第 ${seg.index} 段 Prompt (${seg.totalDuration}s)`);
                    }).catch(() => {
                      const ta = document.createElement("textarea"); ta.value = seg.text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
                      toast.success(`已复制第 ${seg.index} 段`);
                    });
                  }}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    复制本段
                  </Button>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                  {seg.text}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {seg.panels.map((p: any) => (
                    <Badge key={p.panelIndex} variant="outline" className="text-[10px]">
                      #{p.panelIndex} [{p.shotType}] {p.duration}s
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              if (!segmentedExportDialog) return;
              const allText = segmentedExportDialog.segments.map(s => `=== 第 ${s.index} 段 (镜头${s.startPanel}-${s.endPanel}, ${s.totalDuration}s) ===\n${s.text}`).join('\n\n');
              navigator.clipboard.writeText(allText).then(() => toast.success("已复制所有段")).catch(() => toast.error("复制失败"));
            }}>
              复制所有段
            </Button>
            <Button onClick={() => setSegmentedExportDialog(null)}>关闭</Button>
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
    <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg border gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          {done ? <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" /> : step}
        </div>
        <span className={`text-xs sm:text-sm truncate ${done ? "font-medium" : "text-muted-foreground"}`}>{title}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {done && onView && (
          <Button size="sm" variant="ghost" className="h-7 px-2 sm:h-8 sm:px-3" onClick={onView} disabled={disabled}>
            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="text-xs hidden sm:inline ml-1">查看</span>
          </Button>
        )}
        {onRegenerate && (
          <Button size="sm" variant={done ? "outline" : "default"} className="h-7 px-2 sm:h-8 sm:px-3" onClick={onRegenerate} disabled={disabled || loading}>
            {loading ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : (
              done ? <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" /> : <Play className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
            <span className="text-xs ml-1 hidden sm:inline">{confirmLabel || (done ? "重新生成" : "执行")}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
