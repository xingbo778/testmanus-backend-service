import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileJson, Loader2, Database, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ExportManager() {
  const [exportMode, setExportMode] = useState<string>("full");
  const [filterL1, setFilterL1] = useState<string>("");

  const { data: categories } = trpc.category.tree.useQuery();
  const { data: exportHistory, isLoading: historyLoading, refetch } = trpc.export.list.useQuery();

  const exportKB = trpc.export.create.useMutation({
    onSuccess: (data: any) => {
      toast.success("KB导出成功");
      refetch();
      if (data.filePath) {
        window.open(data.filePath, "_blank");
      }
    },
    onError: (err: any) => toast.error(`导出失败: ${err.message}`),
  });

  const l1Categories = categories?.filter((c: any) => c.level === 1) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">KB导出</h1>
        <p className="text-muted-foreground mt-1">将已确认的分镜数据导出为知识库，供视频平台RAG使用</p>
      </div>

      {/* Export Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            导出设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">导出模式</label>
              <Select value={exportMode} onValueChange={setExportMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">全量导出</SelectItem>
                  <SelectItem value="incremental">增量导出</SelectItem>
                  <SelectItem value="category">按分类导出</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {exportMode === "category" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">选择L1分类</label>
                <Select value={filterL1} onValueChange={setFilterL1}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {l1Categories.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-end">
              <Button
                onClick={() => exportKB.mutate({
                  exportType: exportMode === "category" ? "by_category" as const : exportMode === "incremental" ? "incremental" as const : "full" as const,
                  filterCriteria: exportMode === "category" && filterL1 ? { l1Id: filterL1 } : undefined,
                })}
                disabled={exportKB.isPending}
                className="w-full"
              >
                {exportKB.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                导出JSONL
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p className="font-medium mb-1">导出格式说明</p>
            <p className="text-muted-foreground">
              每行一个JSON对象，包含：分类路径、分镜脚本、Grid图URL、每帧Prompt（含model/controlStrategy/references）、
              锚点参考图、用户自定义规则。可直接用于RAG向量化索引。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            导出历史
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : exportHistory?.length ? (
            <div className="space-y-2">
              {exportHistory.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{h.exportMode}</Badge>
                        <Badge variant="secondary" className="text-xs">{h.projectCount} 个项目</Badge>
                        <Badge variant="secondary" className="text-xs">{h.format}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(h.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                  </div>
                  {h.fileUrl && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(h.fileUrl, "_blank")}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">暂无导出记录</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
