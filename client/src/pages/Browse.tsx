import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { FolderTree, Film, Plus, ChevronRight, ArrowLeft } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const STATUS_MAP: Record<string, string> = {
  draft: "草稿",
  scripted: "已生成脚本",
  grid_generated: "已生成Grid",
  reviewing: "审核中",
  confirmed: "已确认",
};

export default function Browse() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { data: categories, isLoading: catLoading } = trpc.category.tree.useQuery();

  const l1Id = params.l1Id;
  const l2Id = params.l2Id;
  const l3Id = params.l3Id;

  // Find current category nodes
  const currentL1 = useMemo(() => categories?.find((c: any) => c.id === l1Id), [categories, l1Id]);
  const currentL2 = useMemo(() => currentL1?.children?.find((c: any) => c.id === l2Id), [currentL1, l2Id]);
  const currentL3 = useMemo(() => currentL2?.children?.find((c: any) => c.id === l3Id), [currentL2, l3Id]);

  // Fetch projects when L3 is selected
  const { data: projects, isLoading: projLoading, refetch: refetchProjects } = trpc.project.list.useQuery(
    l3Id ? { l3Id } : l2Id ? { l2Id } : l1Id ? { l1Id } : {},
  );

  // Create project dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState<"15" | "30">("15");
  const [selectedL1, setSelectedL1] = useState(l1Id || "");
  const [selectedL2, setSelectedL2] = useState(l2Id || "");
  const [selectedL3, setSelectedL3] = useState(l3Id || "");

  const createProject = trpc.project.create.useMutation({
    onSuccess: (data) => {
      toast.success("项目创建成功");
      setCreateOpen(false);
      setNewTitle("");
      refetchProjects();
      navigate(`/project/${data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const selectedL1Cat = useMemo(() => categories?.find((c: any) => c.id === selectedL1), [categories, selectedL1]);
  const selectedL2Cat = useMemo(() => selectedL1Cat?.children?.find((c: any) => c.id === selectedL2), [selectedL1Cat, selectedL2]);

  // Breadcrumb
  const breadcrumbs = [];
  breadcrumbs.push({ label: "分类浏览", path: "/browse" });
  if (currentL1) breadcrumbs.push({ label: currentL1.name, path: `/browse/${l1Id}` });
  if (currentL2) breadcrumbs.push({ label: currentL2.name, path: `/browse/${l1Id}/${l2Id}` });
  if (currentL3) breadcrumbs.push({ label: currentL3.name, path: `/browse/${l1Id}/${l2Id}/${l3Id}` });

  if (catLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm overflow-x-auto">
        {breadcrumbs.map((b, i) => (
          <div key={b.path} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <button
              onClick={() => navigate(b.path)}
              className={`hover:text-primary transition-colors ${i === breadcrumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}`}
            >
              {b.label}
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {l1Id && (
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => {
              if (l3Id) navigate(`/browse/${l1Id}/${l2Id}`);
              else if (l2Id) navigate(`/browse/${l1Id}`);
              else navigate("/browse");
            }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {currentL3?.name || currentL2?.name || currentL1?.name || "分类浏览"}
            </h1>
            {currentL3?.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{currentL3.description}</p>
            )}
          </div>
        </div>
        {(l3Id || l2Id) && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                新建项目
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建分镜项目</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>项目标题</Label>
                  <Input
                    placeholder="输入项目标题..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>L1 分类</Label>
                  <Select value={selectedL1} onValueChange={(v) => { setSelectedL1(v); setSelectedL2(""); setSelectedL3(""); }}>
                    <SelectTrigger><SelectValue placeholder="选择L1分类" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedL1 && (
                  <div className="space-y-2">
                    <Label>L2 分类</Label>
                    <Select value={selectedL2} onValueChange={(v) => { setSelectedL2(v); setSelectedL3(""); }}>
                      <SelectTrigger><SelectValue placeholder="选择L2分类" /></SelectTrigger>
                      <SelectContent>
                        {selectedL1Cat?.children?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedL2 && (
                  <div className="space-y-2">
                    <Label>L3 分类</Label>
                    <Select value={selectedL3} onValueChange={setSelectedL3}>
                      <SelectTrigger><SelectValue placeholder="选择L3分类" /></SelectTrigger>
                      <SelectContent>
                        {selectedL2Cat?.children?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>视频时长</Label>
                  <Select value={newDuration} onValueChange={(v) => setNewDuration(v as "15" | "30")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15秒（6-8帧）</SelectItem>
                      <SelectItem value="30">30秒（10-15帧）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
                <Button
                  onClick={() => {
                    if (!newTitle.trim()) { toast.error("请输入项目标题"); return; }
                    if (!selectedL1 || !selectedL2 || !selectedL3) { toast.error("请选择完整的分类"); return; }
                    createProject.mutate({
                      title: newTitle.trim(),
                      l1Id: selectedL1,
                      l2Id: selectedL2,
                      l3Id: selectedL3,
                      duration: newDuration,
                    });
                  }}
                  disabled={createProject.isPending}
                >
                  {createProject.isPending ? "创建中..." : "创建"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Category Grid or Project List */}
      {!l1Id && (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {categories?.map((cat: any) => (
            <Card
              key={cat.id}
              className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30"
              onClick={() => navigate(`/browse/${cat.id}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-primary" />
                  {cat.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{cat.description || ""}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary">{cat.children?.length ?? 0} 个子分类</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {l1Id && !l2Id && currentL1 && (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {currentL1.children?.map((cat: any) => (
            <Card
              key={cat.id}
              className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30"
              onClick={() => navigate(`/browse/${l1Id}/${cat.id}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{cat.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{cat.description || ""}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary">{cat.children?.length ?? 0} 个场景</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {l2Id && !l3Id && currentL2 && (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {currentL2.children?.map((cat: any) => (
            <Card
              key={cat.id}
              className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30"
              onClick={() => navigate(`/browse/${l1Id}/${l2Id}/${cat.id}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{cat.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{cat.description || ""}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Project List when L3 or deeper is selected */}
      {(l3Id || l2Id) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">分镜项目</h2>
          {projLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : projects?.length ? (
            <div className="grid gap-3">
              {projects.map((p: any) => (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:shadow-md transition-all"
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <CardContent className="flex items-center justify-between p-3 sm:p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Film className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.duration}秒 · v{p.currentVersion} · {new Date(p.updatedAt).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        p.status === "confirmed" ? "default" :
                        p.status === "reviewing" ? "secondary" : "outline"
                      }>
                        {STATUS_MAP[p.status] || p.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Film className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground mb-4">该分类下暂无项目</p>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  创建第一个项目
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
