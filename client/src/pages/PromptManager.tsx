import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Pencil, Save, Loader2, Languages, Copy, Check, Plus, Trash2,
  Clapperboard, Image, Grid3x3, Video, ShieldCheck, Wrench, Brain, RefreshCw,
  ChevronRight
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  script: { label: "脚本生成", icon: Clapperboard, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  anchor: { label: "锚点生成", icon: Image, color: "bg-green-500/10 text-green-500 border-green-500/20" },
  grid: { label: "Grid生成", icon: Grid3x3, color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  prompt: { label: "Prompt生成", icon: Video, color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  validation: { label: "脚本校验", icon: ShieldCheck, color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  panel: { label: "面板修复", icon: Wrench, color: "bg-red-500/10 text-red-500 border-red-500/20" },
  experience: { label: "经验提取", icon: Brain, color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
};

type SystemPromptItem = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  category: string;
  content: string;
  contentZh: string | null;
  isDefault: boolean;
  updatedAt: Date;
  createdAt: Date;
};

export default function PromptManager() {
  const utils = trpc.useUtils();
  const { data: prompts, isLoading } = trpc.systemPrompt.list.useQuery();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showZh, setShowZh] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ key: "", name: "", description: "", category: "script", content: "" });

  const seedMutation = trpc.systemPrompt.seed.useMutation({
    onSuccess: () => {
      utils.systemPrompt.list.invalidate();
      toast.success("默认Prompt已初始化");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const upsertMutation = trpc.systemPrompt.upsert.useMutation({
    onSuccess: () => {
      utils.systemPrompt.list.invalidate();
      toast.success("保存成功");
      setEditMode(false);
      setShowCreate(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateContentMutation = trpc.systemPrompt.updateContent.useMutation({
    onSuccess: () => {
      utils.systemPrompt.list.invalidate();
      toast.success("内容已更新");
      setEditMode(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const translateMutation = trpc.systemPrompt.translate.useMutation({
    onSuccess: (data) => {
      utils.systemPrompt.list.invalidate();
      setShowZh(true);
      toast.success("翻译完成");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = trpc.systemPrompt.delete.useMutation({
    onSuccess: () => {
      utils.systemPrompt.list.invalidate();
      setSelectedKey(null);
      toast.success("已删除");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Group prompts by category
  const groupedPrompts = useMemo(() => {
    if (!prompts) return {};
    const groups: Record<string, SystemPromptItem[]> = {};
    for (const p of prompts as SystemPromptItem[]) {
      const cat = p.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }
    return groups;
  }, [prompts]);

  const selectedPrompt = useMemo(() => {
    if (!prompts || !selectedKey) return null;
    return (prompts as SystemPromptItem[]).find(p => p.key === selectedKey) || null;
  }, [prompts, selectedKey]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("已复制到剪贴板");
  };

  const handleSaveEdit = () => {
    if (!selectedKey || !editContent.trim()) return;
    updateContentMutation.mutate({ key: selectedKey, content: editContent });
  };

  const handleCreate = () => {
    if (!newPrompt.key || !newPrompt.name || !newPrompt.content) {
      toast.error("请填写必填字段");
      return;
    }
    upsertMutation.mutate(newPrompt);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">系统Prompt管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理工作流中使用的系统级Prompt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            <span className="hidden sm:inline">初始化默认</span>
            <span className="sm:hidden">初始化</span>
          </Button>
          <Button size="sm" onClick={() => { setShowCreate(true); setNewPrompt({ key: "", name: "", description: "", category: "script", content: "" }); }}>
            <Plus className="h-4 w-4 mr-1" />
            新增
          </Button>
        </div>
      </div>

      {/* Category Stats */}
      {prompts && (prompts as SystemPromptItem[]).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3">
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const count = groupedPrompts[key]?.length || 0;
            const Icon = config.icon;
            return (
              <Card key={key} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className={`text-xs ${config.color}`}>{config.label}</Badge>
                </div>
                <p className="text-lg font-bold">{count}</p>
              </Card>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : !prompts || (prompts as SystemPromptItem[]).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-4">暂无系统Prompt</p>
            <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              初始化默认Prompt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedPrompts).map(([category, promptList]) => {
            const config = CATEGORY_CONFIG[category] || { label: category, icon: FileText, color: "" };
            const Icon = config.icon;
            return (
              <div key={category}>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <Badge variant="outline" className={config.color}>{config.label}</Badge>
                  <span className="text-sm text-muted-foreground font-normal">{promptList.length}个</span>
                </h2>
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                  {promptList.map((p) => (
                    <Card
                      key={p.key}
                      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
                      onClick={() => {
                        setSelectedKey(p.key);
                        setEditMode(false);
                        setShowZh(!!p.contentZh);
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>{p.name}</span>
                            {!p.isDefault && <Badge variant="secondary" className="text-[10px] px-1.5">自定义</Badge>}
                          </div>
                          <div className="flex items-center gap-1">
                            {p.contentZh && <Languages className="h-3.5 w-3.5 text-blue-500" />}
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground line-clamp-2">{p.description || p.content.slice(0, 100)}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono">{p.key}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== Prompt Detail Dialog ==================== */}
      <Dialog open={selectedKey !== null} onOpenChange={(open) => {
        if (!open) { setSelectedKey(null); setEditMode(false); setShowZh(false); }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedPrompt && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {selectedPrompt.name}
                  {!selectedPrompt.isDefault && <Badge variant="secondary" className="text-xs">自定义</Badge>}
                </DialogTitle>
                <DialogDescription>
                  {selectedPrompt.description}
                  <span className="ml-2 font-mono text-[10px]">({selectedPrompt.key})</span>
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 justify-end flex-wrap">
                <Button size="sm" variant="outline" onClick={() => translateMutation.mutate({ key: selectedPrompt.key })} disabled={translateMutation.isPending}>
                  {translateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Languages className="h-4 w-4 mr-1" />}
                  翻译成中文
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleCopy(editMode ? editContent : selectedPrompt.content)}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copied ? "已复制" : "复制"}
                </Button>
                <Button size="sm" variant={editMode ? "default" : "outline"} onClick={() => {
                  if (!editMode) {
                    setEditContent(selectedPrompt.content);
                    setEditMode(true);
                  } else {
                    setEditMode(false);
                  }
                }}>
                  <Pencil className="h-4 w-4 mr-1" />
                  {editMode ? "取消编辑" : "编辑"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => {
                  if (confirm("确定删除此Prompt？")) deleteMutation.mutate({ key: selectedPrompt.key });
                }}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  删除
                </Button>
              </div>

              <ScrollArea className="max-h-[50vh]">
                {editMode ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="输入Prompt内容..."
                  />
                ) : (
                  <Tabs defaultValue={showZh && selectedPrompt.contentZh ? "zh" : "en"} className="w-full">
                    <TabsList className="mb-2">
                      <TabsTrigger value="en">English</TabsTrigger>
                      <TabsTrigger value="zh" disabled={!selectedPrompt.contentZh}>
                        中文
                        {!selectedPrompt.contentZh && <span className="ml-1 text-[10px]">(未翻译)</span>}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="en">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{selectedPrompt.content}</pre>
                      </div>
                    </TabsContent>
                    <TabsContent value="zh">
                      {selectedPrompt.contentZh ? (
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4">
                          <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{selectedPrompt.contentZh}</pre>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Languages className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p>尚未翻译，点击"翻译成中文"按钮生成翻译</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </ScrollArea>

              {editMode && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditMode(false)}>取消</Button>
                  <Button onClick={handleSaveEdit} disabled={updateContentMutation.isPending}>
                    {updateContentMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    保存修改
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== Create Prompt Dialog ==================== */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新增系统Prompt</DialogTitle>
            <DialogDescription>创建一个新的系统级Prompt模板</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Key (唯一标识)</label>
                <Input
                  value={newPrompt.key}
                  onChange={(e) => setNewPrompt({ ...newPrompt, key: e.target.value })}
                  placeholder="e.g. script_custom_v2"
                  className="font-mono"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">分类</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={newPrompt.category}
                  onChange={(e) => setNewPrompt({ ...newPrompt, category: e.target.value })}
                >
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">名称</label>
              <Input
                value={newPrompt.name}
                onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                placeholder="e.g. 自定义脚本生成 Prompt"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">描述</label>
              <Input
                value={newPrompt.description}
                onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                placeholder="简要描述此Prompt的用途"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">内容</label>
              <Textarea
                value={newPrompt.content}
                onChange={(e) => setNewPrompt({ ...newPrompt, content: e.target.value })}
                className="min-h-[200px] font-mono text-sm"
                placeholder="输入Prompt内容..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
