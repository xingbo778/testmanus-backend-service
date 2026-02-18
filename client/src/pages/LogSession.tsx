import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Trash2, Search, AlertCircle, AlertTriangle, Info, Bug, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { toast } from "sonner";

const LEVEL_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  error: { color: "bg-red-500/10 text-red-400 border-red-500/30", icon: <AlertCircle className="h-3.5 w-3.5" />, label: "ERROR" },
  warn: { color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "WARN" },
  info: { color: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: <Info className="h-3.5 w-3.5" />, label: "INFO" },
  debug: { color: "bg-gray-500/10 text-gray-400 border-gray-500/30", icon: <Bug className="h-3.5 w-3.5" />, label: "DEBUG" },
};

const SOURCE_LABELS: Record<string, string> = {
  script_gen: "脚本生成",
  anchor_gen: "锚点生成",
  grid_gen: "Grid生成",
  panel_fix: "面板修复",
  prompt_gen: "Prompt生成",
  video_gen: "视频生成",
  export: "导出",
  system: "系统",
};

export default function LogSession() {
  const [level, setLevel] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set<number>([]));
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const limit = 50;

  const { data, isLoading, refetch } = trpc.appLog.list.useQuery({
    limit,
    offset: page * limit,
    level: level || undefined,
    source: source || undefined,
    search: search || undefined,
  }, {
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const clearMutation = trpc.appLog.clear.useMutation({
    onSuccess: () => {
      toast.success("日志已清除");
      refetch();
    },
    onError: (err) => toast.error(`清除失败: ${err.message}`),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">日志中心</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看系统操作日志，追踪生成流程和错误信息
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "自动刷新中" : "自动刷新"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("确定要清除所有日志吗？")) {
                clearMutation.mutate({});
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            清除
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 flex-1">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={level} onValueChange={(v) => { setLevel(v === "all" ? "" : v); setPage(0); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="级别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部级别</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
              <Select value={source} onValueChange={(v) => { setSource(v === "all" ? "" : v); setPage(0); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
              <Input
                placeholder="搜索日志内容..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>共 <strong className="text-foreground">{total}</strong> 条日志</span>
        {totalPages > 1 && (
          <span>第 {page + 1} / {totalPages} 页</span>
        )}
      </div>

      {/* Log entries */}
      <div className="space-y-1">
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              加载中...
            </CardContent>
          </Card>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              暂无日志记录
            </CardContent>
          </Card>
        ) : (
          logs.map((log: any) => {
            const config = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.info;
            const isExpanded = expandedIds.has(log.id);
            const hasDetails = log.details && Object.keys(log.details).length > 0;

            return (
              <div
                key={log.id}
                className={`border rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 transition-colors hover:bg-muted/30 ${
                  log.level === "error" ? "border-red-500/20 bg-red-500/5" :
                  log.level === "warn" ? "border-yellow-500/20 bg-yellow-500/5" :
                  "border-border"
                }`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  {/* Level badge */}
                  <Badge variant="outline" className={`${config.color} shrink-0 text-[10px] px-1.5 py-0 font-mono mt-0.5`}>
                    {config.icon}
                    <span className="ml-1 hidden sm:inline">{config.label}</span>
                  </Badge>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                        {SOURCE_LABELS[log.source] || log.source}
                      </Badge>
                      {log.projectId && (
                        <span className="text-[10px] text-muted-foreground">
                          P#{log.projectId}
                        </span>
                      )}
                      {log.panelIndex && (
                        <span className="text-[10px] text-muted-foreground">
                          Panel#{log.panelIndex}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1 break-all">{log.message}</p>

                    {/* Expanded details */}
                    {isExpanded && hasDetails && (
                      <pre className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>

                  {/* Time + expand */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatTime(log.createdAt)}
                    </span>
                    {hasDetails && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => toggleExpand(log.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
