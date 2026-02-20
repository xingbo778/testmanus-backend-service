import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  Search,
  User,
  MapPin,
  Package,
  RefreshCw,
  MoreVertical,
  Pencil,
  Trash2,
  Wand2,
  ImageIcon,
  Filter,
  Loader2,
  Copy,
} from "lucide-react";

const ANCHOR_TYPE_MAP: Record<string, { label: string; icon: typeof User; color: string }> = {
  character: { label: "角色", icon: User, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  scene: { label: "场景", icon: MapPin, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  prop: { label: "道具", icon: Package, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

const STYLE_OPTIONS = [
  "anime", "photorealistic", "watercolor", "oil-painting", "pixel-art",
  "3d-render", "sketch", "comic", "cinematic", "fantasy",
  "cyberpunk", "steampunk", "minimalist", "retro", "noir",
];

type AnchorItem = {
  id: number;
  name: string;
  anchorType: "character" | "scene" | "prop";
  description: string | null;
  prompt: string | null;
  imageUrl: string | null;
  style: string | null;
  tags: unknown;
  metadata: unknown;
  usageCount: number;
  createdAt: Date;
};

export default function AnchorLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStyle, setFilterStyle] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnchorItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<AnchorItem | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"character" | "scene" | "prop">("character");
  const [formDescription, setFormDescription] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formStyle, setFormStyle] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [generateImage, setGenerateImage] = useState(true);

  const utils = trpc.useUtils();
  const { data: listData, isLoading } = trpc.anchorLib.list.useQuery({
    anchorType: filterType === "all" ? undefined : filterType as any,
    style: filterStyle === "all" ? undefined : filterStyle,
    search: searchQuery || undefined,
    limit: 100,
  });
  const items = listData?.items;

  const createMutation = trpc.anchorLib.create.useMutation({
    onSuccess: () => {
      toast.success("Anchor创建成功");
      setCreateDialogOpen(false);
      resetForm();
      utils.anchorLib.list.invalidate();
    },
    onError: (err) => toast.error(`创建失败: ${err.message}`),
  });

  const createWithImageMutation = trpc.anchorLib.createWithImage.useMutation({
    onSuccess: (data) => {
      toast.success(data.imageUrl ? "Anchor创建成功（含生成图片）" : "Anchor创建成功（图片生成失败）");
      setCreateDialogOpen(false);
      resetForm();
      utils.anchorLib.list.invalidate();
    },
    onError: (err) => toast.error(`创建失败: ${err.message}`),
  });

  const updateMutation = trpc.anchorLib.update.useMutation({
    onSuccess: () => {
      toast.success("Anchor更新成功");
      setEditDialogOpen(false);
      setEditingItem(null);
      utils.anchorLib.list.invalidate();
    },
    onError: (err) => toast.error(`更新失败: ${err.message}`),
  });

  const deleteMutation = trpc.anchorLib.delete.useMutation({
    onSuccess: () => {
      toast.success("Anchor已删除");
      utils.anchorLib.list.invalidate();
    },
    onError: (err) => toast.error(`删除失败: ${err.message}`),
  });

  const regenImageMutation = trpc.anchorLib.regenerateImage.useMutation({
    onSuccess: () => {
      toast.success("图片重新生成成功");
      utils.anchorLib.list.invalidate();
    },
    onError: (err) => toast.error(`图片生成失败: ${err.message}`),
  });

  const resetForm = () => {
    setFormName("");
    setFormType("character");
    setFormDescription("");
    setFormPrompt("");
    setFormStyle("");
    setFormTags("");
    setFormImageUrl("");
    setGenerateImage(true);
  };

  const handleCreate = () => {
    const tags = formTags ? formTags.split(",").map(t => t.trim()).filter(Boolean) : undefined;
    if (generateImage && formPrompt) {
      createWithImageMutation.mutate({
        name: formName,
        anchorType: formType,
        description: formDescription || undefined,
        prompt: formPrompt,
        style: formStyle || undefined,
        tags,
      });
    } else {
      createMutation.mutate({
        name: formName,
        anchorType: formType,
        description: formDescription || undefined,
        prompt: formPrompt || undefined,
        imageUrl: formImageUrl || undefined,
        style: formStyle || undefined,
        tags,
      });
    }
  };

  const handleEdit = () => {
    if (!editingItem) return;
    const tags = formTags ? formTags.split(",").map(t => t.trim()).filter(Boolean) : undefined;
    updateMutation.mutate({
      id: editingItem.id,
      name: formName || undefined,
      description: formDescription || undefined,
      prompt: formPrompt || undefined,
      imageUrl: formImageUrl || undefined,
      style: formStyle || undefined,
      tags,
    });
  };

  const openEdit = (item: AnchorItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormType(item.anchorType);
    setFormDescription(item.description || "");
    setFormPrompt(item.prompt || "");
    setFormStyle(item.style || "");
    setFormTags(Array.isArray(item.tags) ? (item.tags as string[]).join(", ") : "");
    setFormImageUrl(item.imageUrl || "");
    setEditDialogOpen(true);
  };

  // Stats
  const stats = useMemo(() => {
    if (!items) return { total: 0, characters: 0, scenes: 0, props: 0 };
    return {
      total: items.length,
      characters: items.filter((i: any) => i.anchorType === "character").length,
      scenes: items.filter((i: any) => i.anchorType === "scene").length,
      props: items.filter((i: any) => i.anchorType === "prop").length,
    };
  }, [items]);

  const isCreating = createMutation.isPending || createWithImageMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Anchor 库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理全局角色、场景和道具参考图，跨项目复用保持风格一致
          </p>
        </div>
        <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          新建 Anchor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "总计", value: stats.total, color: "text-foreground" },
          { label: "角色", value: stats.characters, color: "text-blue-400" },
          { label: "场景", value: stats.scenes, color: "text-emerald-400" },
          { label: "道具", value: stats.props, color: "text-amber-400" },
        ].map(s => (
          <Card key={s.label} className="bg-card/50">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索名称或描述..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="character">角色</SelectItem>
            <SelectItem value="scene">场景</SelectItem>
            <SelectItem value="prop">道具</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStyle} onValueChange={setFilterStyle}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="风格" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部风格</SelectItem>
            {STYLE_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !items?.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Anchor库为空</p>
          <p className="text-sm mt-1">点击"新建 Anchor"开始创建角色、场景或道具参考</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item: any) => {
            const typeInfo = ANCHOR_TYPE_MAP[item.anchorType];
            const TypeIcon = typeInfo?.icon || User;
            return (
              <Card
                key={item.id}
                className="group overflow-hidden hover:ring-1 hover:ring-primary/30 transition-all cursor-pointer"
                onClick={() => { setDetailItem(item as AnchorItem); setDetailDialogOpen(true); }}
              >
                {/* Image */}
                <div className="aspect-[4/3] bg-muted/30 relative overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <TypeIcon className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Type badge */}
                  <Badge className={`absolute top-2 left-2 ${typeInfo?.color} border text-xs`}>
                    <TypeIcon className="h-3 w-3 mr-1" />
                    {typeInfo?.label}
                  </Badge>
                  {/* Actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="secondary" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(item as AnchorItem); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> 编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={e => { e.stopPropagation(); regenImageMutation.mutate({ id: item.id }); }}
                          disabled={regenImageMutation.isPending}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-2" /> 重新生成图片
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={e => {
                          e.stopPropagation();
                          if (item.prompt) {
                            navigator.clipboard.writeText(item.prompt);
                            toast.success("Prompt已复制");
                          }
                        }}>
                          <Copy className="h-3.5 w-3.5 mr-2" /> 复制Prompt
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={e => {
                            e.stopPropagation();
                            if (confirm(`确定删除 "${item.name}" 吗？`)) {
                              deleteMutation.mutate({ id: item.id });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> 删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {/* Info */}
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                    {item.style && (
                      <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{item.style}</Badge>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                  )}
                  {item.tags && Array.isArray(item.tags) && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(item.tags as string[]).slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                      ))}
                      {(item.tags as string[]).length > 3 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{(item.tags as string[]).length - 3}</Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                    <span>使用 {item.usageCount} 次</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              新建 Anchor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">名称 *</label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="例: 武术大师 Wei" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">类型 *</label>
                <Select value={formType} onValueChange={v => setFormType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="character">角色</SelectItem>
                    <SelectItem value="scene">场景</SelectItem>
                    <SelectItem value="prop">道具</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">描述</label>
              <Textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="角色/场景/道具的简要描述..."
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">生成 Prompt（英文）</label>
              <Textarea
                value={formPrompt}
                onChange={e => setFormPrompt(e.target.value)}
                placeholder="A wise elderly martial arts master with flowing silver hair, wearing traditional white hanfu..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">风格</label>
                <Select value={formStyle} onValueChange={setFormStyle}>
                  <SelectTrigger><SelectValue placeholder="选择风格" /></SelectTrigger>
                  <SelectContent>
                    {STYLE_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">标签（逗号分隔）</label>
                <Input
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  placeholder="武侠, 古装, 老者"
                />
              </div>
            </div>
            {!generateImage && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">图片URL（手动提供）</label>
                <Input
                  value={formImageUrl}
                  onChange={e => setFormImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="genImage"
                checked={generateImage}
                onChange={e => setGenerateImage(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="genImage" className="text-sm">根据Prompt自动生成参考图</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!formName || isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCreating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              编辑 Anchor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">名称</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">描述</label>
              <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prompt</label>
              <Textarea value={formPrompt} onChange={e => setFormPrompt(e.target.value)} rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">风格</label>
                <Select value={formStyle} onValueChange={setFormStyle}>
                  <SelectTrigger><SelectValue placeholder="选择风格" /></SelectTrigger>
                  <SelectContent>
                    {STYLE_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">标签</label>
                <Input value={formTags} onChange={e => setFormTags(e.target.value)} placeholder="逗号分隔" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">图片URL</label>
              <Input value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => { const T = ANCHOR_TYPE_MAP[detailItem.anchorType]; return T ? <T.icon className="h-5 w-5" /> : null; })()}
                  {detailItem.name}
                  <Badge className={`${ANCHOR_TYPE_MAP[detailItem.anchorType]?.color} border text-xs ml-2`}>
                    {ANCHOR_TYPE_MAP[detailItem.anchorType]?.label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {detailItem.imageUrl && (
                  <div className="rounded-lg overflow-hidden bg-muted/30">
                    <img src={detailItem.imageUrl} alt={detailItem.name} className="w-full max-h-[400px] object-contain" />
                  </div>
                )}
                {detailItem.description && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">描述</h4>
                    <p className="text-sm">{detailItem.description}</p>
                  </div>
                )}
                {detailItem.prompt && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-medium text-muted-foreground">Prompt</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(detailItem.prompt!);
                          toast.success("Prompt已复制");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" /> 复制
                      </Button>
                    </div>
                    <pre className="text-xs bg-muted/30 rounded-lg p-3 whitespace-pre-wrap font-mono">{detailItem.prompt}</pre>
                  </div>
                )}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {detailItem.style && <span>风格: <Badge variant="outline" className="text-[10px]">{detailItem.style}</Badge></span>}
                  <span>使用次数: {detailItem.usageCount}</span>
                  <span>创建时间: {new Date(detailItem.createdAt).toLocaleString()}</span>
                </div>
                {(() => {
                  const tagArr = Array.isArray(detailItem.tags) ? detailItem.tags as string[] : [];
                  return tagArr.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {tagArr.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{String(tag)}</Badge>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => openEdit(detailItem)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> 编辑
                </Button>
                <Button
                  variant="outline"
                  onClick={() => regenImageMutation.mutate({ id: detailItem.id })}
                  disabled={regenImageMutation.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-2 ${regenImageMutation.isPending ? "animate-spin" : ""}`} />
                  重新生成图片
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
