import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderTree, Film, BookOpen, Download, Plus, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const [, navigate] = useLocation();
  const { data: categories, isLoading: catLoading } = trpc.category.tree.useQuery();
  const { data: projects, isLoading: projLoading } = trpc.project.list.useQuery({});
  const { data: experiences, isLoading: expLoading } = trpc.experience.list.useQuery({});

  const totalL1 = categories?.length ?? 0;
  const totalL2 = categories?.reduce((sum: number, c: any) => sum + (c.children?.length ?? 0), 0) ?? 0;
  const totalL3 = categories?.reduce((sum: number, c: any) =>
    sum + (c.children?.reduce((s2: number, c2: any) => s2 + (c2.children?.length ?? 0), 0) ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">总览</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">分镜标注与管理平台</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/browse")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">分类体系</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {catLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{totalL1}</span>
                <span className="text-sm text-muted-foreground">L1</span>
                <span className="text-lg font-semibold text-muted-foreground">{totalL2}</span>
                <span className="text-sm text-muted-foreground">L2</span>
                <span className="text-lg font-semibold text-muted-foreground">{totalL3}</span>
                <span className="text-sm text-muted-foreground">L3</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/browse")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">分镜项目</CardTitle>
            <Film className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {projLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{projects?.length ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">已创建的分镜项目总数</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/experience")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">经验记录</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {expLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{experiences?.length ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">标注调整中积累的经验</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/export")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">KB导出</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">JSONL</div>
            <p className="text-xs text-muted-foreground mt-1">导出为知识库供RAG使用</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快速操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/browse")}>
              <Plus className="mr-2 h-4 w-4" />
              创建新分镜项目
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/rules")}>
              <BookOpen className="mr-2 h-4 w-4" />
              管理规则手册
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/export")}>
              <Download className="mr-2 h-4 w-4" />
              导出知识库
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">最近项目</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/browse")}>
              查看全部 <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {projLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : projects?.length ? (
              <div className="space-y-2">
                {projects.slice(0, 5).map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/project/${p.id}`)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{p.title}</span>
                    </div>
                    <Badge variant={
                      p.status === "confirmed" ? "default" :
                      p.status === "reviewing" ? "secondary" : "outline"
                    } className="shrink-0 text-xs">
                      {p.status === "confirmed" ? "已确认" :
                       p.status === "reviewing" ? "审核中" :
                       p.status === "draft" ? "草稿" : p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">暂无项目，点击"创建新分镜项目"开始</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
