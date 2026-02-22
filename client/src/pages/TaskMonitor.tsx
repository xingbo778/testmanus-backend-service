import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Film,
  Image,
  FileText,
  Grid3X3,
  RefreshCw,
  ExternalLink,
  Activity,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Loader2 }> = {
  draft: { label: "草稿", color: "bg-gray-500", icon: Clock },
  scripted: { label: "脚本完成", color: "bg-blue-500", icon: FileText },
  anchors_generated: { label: "锚点完成", color: "bg-indigo-500", icon: Image },
  grid_generating: { label: "Grid生成中", color: "bg-yellow-500", icon: Loader2 },
  grid_generated: { label: "Grid完成", color: "bg-green-500", icon: Grid3X3 },
  reviewing: { label: "审查中", color: "bg-orange-500", icon: Activity },
  confirmed: { label: "已确认", color: "bg-emerald-600", icon: CheckCircle2 },
};

const VIDEO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "等待中", color: "bg-gray-500" },
  generating: { label: "生成中", color: "bg-yellow-500" },
  upsampling: { label: "增强中", color: "bg-blue-500" },
  completed: { label: "已完成", color: "bg-green-500" },
  trimmed: { label: "已裁剪", color: "bg-teal-500" },
  failed: { label: "失败", color: "bg-red-500" },
};

export default function TaskMonitor() {
  const [, setLocation] = useLocation();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Get all projects with generating status
  const allProjects = trpc.project.list.useQuery({});
  const recentLogs = trpc.appLog.list.useQuery({ limit: 50 });

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      allProjects.refetch();
      recentLogs.refetch();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const projects = allProjects.data ?? [];

  // Categorize projects
  const generatingProjects = projects.filter(
    (p: any) => p.status === "grid_generating"
  );
  const recentCompleted = projects
    .filter((p: any) => p.status === "grid_generated" || p.status === "confirmed")
    .slice(0, 20);
  const draftProjects = projects.filter(
    (p: any) => p.status === "draft" || p.status === "scripted" || p.status === "anchors_generated"
  );
  const reviewingProjects = projects.filter((p: any) => p.status === "reviewing");

  // Extract recent task logs
  const logs = (recentLogs.data?.logs ?? []) as any[];
  const taskLogs = logs.filter(
    (l: any) =>
      l.source === "grid_gen" ||
      l.source === "anchor_gen" ||
      l.source === "prompt_gen" ||
      l.source === "video_gen" ||
      l.source === "panel_extract" ||
      l.source === "panel_fix"
  );

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "grid_gen":
      case "grid_regen":
        return <Grid3X3 className="h-4 w-4" />;
      case "anchor_gen":
        return <Image className="h-4 w-4" />;
      case "prompt_gen":
        return <FileText className="h-4 w-4" />;
      case "video_gen":
        return <Film className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "grid_gen": return "Grid生成";
      case "grid_regen": return "Grid重合成";
      case "anchor_gen": return "Anchor生成";
      case "anchor_import": return "Anchor导入";
      case "prompt_gen": return "Prompt生成";
      case "video_gen": return "视频生成";
      case "panel_extract": return "面板提取";
      case "panel_fix": return "面板修复";
      default: return source;
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">生产任务</h1>
          <p className="text-muted-foreground text-sm mt-1">
            监控Grid生成、Anchor生成、视频生成等异步任务的实时状态
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                自动刷新中
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1" />
                已暂停
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              allProjects.refetch();
              recentLogs.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
              </div>
              <div>
                <p className="text-2xl font-bold">{generatingProjects.length}</p>
                <p className="text-xs text-muted-foreground">生成中</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Activity className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reviewingProjects.length}</p>
                <p className="text-xs text-muted-foreground">审查中</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{draftProjects.length}</p>
                <p className="text-xs text-muted-foreground">待处理</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{projects.length}</p>
                <p className="text-xs text-muted-foreground">总项目数</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            进行中
            {generatingProjects.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-xs">
                {generatingProjects.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recent">最近完成</TabsTrigger>
          <TabsTrigger value="pending">待处理</TabsTrigger>
          <TabsTrigger value="logs">任务日志</TabsTrigger>
        </TabsList>

        {/* Active / Generating Tasks */}
        <TabsContent value="active" className="mt-4">
          {generatingProjects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">暂无进行中的任务</p>
                <p className="text-sm mt-1">所有生成任务已完成</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {generatingProjects.map((p: any) => {
                const config = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
                const Icon = config.icon;
                return (
                  <Card
                    key={p.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setLocation(`/project/${p.id}`)}
                  >
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${config.color}/10`}>
                            <Icon className={`h-5 w-5 ${p.status === "grid_generating" ? "animate-spin text-yellow-500" : ""}`} />
                          </div>
                          <div>
                            <p className="font-medium">{p.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs">
                                {p.duration}秒
                              </Badge>
                              <Badge className={`text-xs text-white ${config.color}`}>
                                {config.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                ID: {p.id}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatTime(p.updatedAt)}
                          </span>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Recently Completed */}
        <TabsContent value="recent" className="mt-4">
          {recentCompleted.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>暂无最近完成的项目</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentCompleted.map((p: any) => {
                const config = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
                const Icon = config.icon;
                return (
                  <Card
                    key={p.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setLocation(`/project/${p.id}`)}
                  >
                    <CardContent className="py-3 px-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-green-500" />
                          <div>
                            <p className="font-medium text-sm">{p.title}</p>
                            <span className="text-xs text-muted-foreground">
                              {p.duration}秒 · ID: {p.id}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs text-white ${config.color}`}>
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(p.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Pending / Draft */}
        <TabsContent value="pending" className="mt-4">
          {draftProjects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>暂无待处理的项目</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {draftProjects.map((p: any) => {
                const config = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
                const Icon = config.icon;
                return (
                  <Card
                    key={p.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setLocation(`/project/${p.id}`)}
                  >
                    <CardContent className="py-3 px-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{p.title}</p>
                            <span className="text-xs text-muted-foreground">
                              {p.duration}秒 · ID: {p.id}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(p.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Task Logs */}
        <TabsContent value="logs" className="mt-4">
          {taskLogs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>暂无任务日志</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {taskLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5">
                    {getSourceIcon(log.source)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          log.level === "error"
                            ? "border-red-500 text-red-500"
                            : log.level === "warn"
                            ? "border-yellow-500 text-yellow-500"
                            : "border-green-500 text-green-500"
                        }`}
                      >
                        {getSourceLabel(log.source)}
                      </Badge>
                      {log.details?.projectId && (
                        <span
                          className="text-xs text-blue-400 cursor-pointer hover:underline"
                          onClick={() => setLocation(`/project/${log.details.projectId}`)}
                        >
                          项目 #{log.details.projectId}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {log.message}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
