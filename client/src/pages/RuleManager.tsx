import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Database, Loader2, ChevronRight, CheckCircle, XCircle, AlertTriangle, Info,
  Plus, Pencil, Trash2, Save, FolderPlus, FolderEdit
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  universal: "通用规则", scene_specific: "场景规则", technical: "技术规则", ai_prompt: "AI提示规则",
};

const CATEGORY_COLORS: Record<string, string> = {
  universal: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  scene_specific: "bg-green-500/10 text-green-500 border-green-500/20",
  technical: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  ai_prompt: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

const SEVERITY_ICONS: Record<string, typeof CheckCircle> = { critical: XCircle, warning: AlertTriangle, info: Info };
const SEVERITY_COLORS: Record<string, string> = { critical: "text-red-500", warning: "text-yellow-500", info: "text-blue-400" };

export default function RuleManager() {
  const utils = trpc.useUtils();
  const { data: chapters, isLoading } = trpc.rule.chapters.useQuery();
  const [selectedChapterNumber, setSelectedChapterNumber] = useState<number | null>(null);

  // Chapter CRUD state
  const [chapterFormOpen, setChapterFormOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<any>(null);
  const [chapterForm, setChapterForm] = useState({ title: "", category: "universal", chapterNumber: 0 });
  const [deleteChapterDialog, setDeleteChapterDialog] = useState<any>(null);

  // Rule CRUD state
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<{ idx: number; data: any } | null>(null);
  const [ruleForm, setRuleForm] = useState({ text: "", type: "do", severity: "info" });
  const [deleteRuleDialog, setDeleteRuleDialog] = useState<{ idx: number } | null>(null);

  // Category CRUD state
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ key: "", label: "", description: "" });
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [deleteCategoryDialog, setDeleteCategoryDialog] = useState<string | null>(null);

  const seedRules = trpc.rule.seed.useMutation({
    onSuccess: () => { toast.success("规则手册导入成功"); utils.rule.chapters.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  const chapterDetail = trpc.rule.chapterDetail.useQuery(
    { chapterNumber: selectedChapterNumber! },
    { enabled: selectedChapterNumber !== null }
  );

  // Chapter mutations
  const createChapter = trpc.rule.createChapter.useMutation({
    onSuccess: () => { toast.success("章节已创建"); utils.rule.chapters.invalidate(); setChapterFormOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateChapter = trpc.rule.updateChapter.useMutation({
    onSuccess: () => { toast.success("章节已更新"); utils.rule.chapters.invalidate(); utils.rule.chapterDetail.invalidate(); setChapterFormOpen(false); setEditingChapter(null); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteChapter = trpc.rule.deleteChapter.useMutation({
    onSuccess: () => { toast.success("章节已删除"); utils.rule.chapters.invalidate(); setDeleteChapterDialog(null); setSelectedChapterNumber(null); },
    onError: (err: any) => toast.error(err.message),
  });

  // Rule mutations
  const addRule = trpc.rule.addRule.useMutation({
    onSuccess: () => { toast.success("规则已添加"); utils.rule.chapterDetail.invalidate(); utils.rule.chapters.invalidate(); setRuleFormOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateRule = trpc.rule.updateRule.useMutation({
    onSuccess: () => { toast.success("规则已更新"); utils.rule.chapterDetail.invalidate(); setRuleFormOpen(false); setEditingRule(null); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteRule = trpc.rule.deleteRule.useMutation({
    onSuccess: () => { toast.success("规则已删除"); utils.rule.chapterDetail.invalidate(); utils.rule.chapters.invalidate(); setDeleteRuleDialog(null); },
    onError: (err: any) => toast.error(err.message),
  });

  // Category mutations (using categoryManage router)
  const createCategory = trpc.categoryManage.create.useMutation({
    onSuccess: () => { toast.success("分类已创建"); utils.rule.chapters.invalidate(); setCategoryFormOpen(false); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateCategory = trpc.categoryManage.update.useMutation({
    onSuccess: () => { toast.success("分类已更新"); utils.rule.chapters.invalidate(); setCategoryFormOpen(false); setEditingCategory(null); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteCategory = trpc.categoryManage.delete.useMutation({
    onSuccess: () => { toast.success("分类已删除"); utils.rule.chapters.invalidate(); setDeleteCategoryDialog(null); },
    onError: (err: any) => toast.error(err.message),
  });

  const rules = (() => {
    if (!chapterDetail.data?.rules) return [];
    try {
      const raw = typeof chapterDetail.data.rules === "string" ? JSON.parse(chapterDetail.data.rules as string) : chapterDetail.data.rules;
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  })();

  const groupedChapters = (() => {
    if (!chapters) return {};
    const groups: Record<string, typeof chapters> = {};
    for (const ch of chapters) {
      const cat = ch.category || "universal";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ch);
    }
    return groups;
  })();

  const totalRules = chapters?.reduce((sum: number, ch: any) => sum + (ch.ruleCount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">规则手册</h1>
          <p className="text-muted-foreground mt-1">
            分镜设计终极规则手册，共{chapters?.length || 0}章{totalRules}条规则
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            setCategoryForm({ key: "", label: "", description: "" });
            setEditingCategory(null);
            setCategoryFormOpen(true);
          }}>
            <FolderPlus className="mr-2 h-4 w-4" />
            新增分类
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const nextNum = (chapters?.length || 0) + 1;
            setChapterForm({ title: "", category: "universal", chapterNumber: nextNum });
            setEditingChapter(null);
            setChapterFormOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            新增章节
          </Button>
          <Button variant="outline" size="sm" onClick={() => seedRules.mutate()} disabled={seedRules.isPending}>
            {seedRules.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
            重新导入
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {chapters && chapters.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const count = groupedChapters[key]?.length || 0;
            const ruleCount = groupedChapters[key]?.reduce((sum: number, ch: any) => sum + (ch.ruleCount || 0), 0) || 0;
            return (
              <Card key={key} className="p-3 group relative">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[key] || ""}`}>{label}</Badge>
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => {
                      setCategoryForm({ key, label, description: "" });
                      setEditingCategory(key);
                      setCategoryFormOpen(true);
                    }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={() => setDeleteCategoryDialog(key)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-lg font-bold">{count} <span className="text-sm font-normal text-muted-foreground">章</span></p>
                <p className="text-xs text-muted-foreground">{ruleCount} 条规则</p>
              </Card>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : chapters?.length ? (
        <div className="space-y-6">
          {Object.entries(groupedChapters).map(([category, chapterList]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline" className={`${CATEGORY_COLORS[category] || ""}`}>
                  {CATEGORY_LABELS[category] || category}
                </Badge>
                <span className="text-sm text-muted-foreground font-normal">{chapterList.length}章</span>
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {chapterList.map((ch: any) => (
                  <Card key={ch.id} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group relative"
                    onClick={() => setSelectedChapterNumber(ch.chapterNumber)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="line-clamp-1">第{ch.chapterNumber}章 · {ch.title}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); setEditingChapter(ch); setChapterForm({ title: ch.title, category: ch.category || "universal", chapterNumber: ch.chapterNumber }); setChapterFormOpen(true); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteChapterDialog(ch); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Badge variant="secondary" className="text-xs">{ch.ruleCount ?? 0} 条规则</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-4">规则手册尚未导入</p>
            <Button onClick={() => seedRules.mutate()} disabled={seedRules.isPending}>
              {seedRules.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              导入规则手册
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ==================== Chapter Detail Dialog ==================== */}
      <Dialog open={selectedChapterNumber !== null} onOpenChange={(open) => !open && setSelectedChapterNumber(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              第{selectedChapterNumber}章 · {chapterDetail.data?.title || "加载中..."}
            </DialogTitle>
            <DialogDescription>
              {chapterDetail.data && (
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[chapterDetail.data.category] || ""}`}>
                    {CATEGORY_LABELS[chapterDetail.data.category] || chapterDetail.data.category}
                  </Badge>
                  <span>{chapterDetail.data.ruleCount} 条规则</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => {
              setRuleForm({ text: "", type: "do", severity: "info" });
              setEditingRule(null);
              setRuleFormOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-1" />
              添加规则
            </Button>
          </div>
          <ScrollArea className="max-h-[55vh] pr-4">
            {chapterDetail.isLoading ? (
              <div className="space-y-2 py-4">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}</div>
            ) : rules.length > 0 ? (
              <div className="space-y-2 py-2">
                {rules.map((rule: any, idx: number) => {
                  const SeverityIcon = SEVERITY_ICONS[rule.severity] || Info;
                  const severityColor = SEVERITY_COLORS[rule.severity] || "text-muted-foreground";
                  const isDoRule = rule.type === "do";

                  return (
                    <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border group ${
                      isDoRule ? "bg-green-500/5 border-green-500/10" : "bg-red-500/5 border-red-500/10"
                    }`}>
                      <div className="shrink-0 mt-0.5">
                        {isDoRule ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-[10px] ${isDoRule ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}`}>
                            {isDoRule ? "DO" : "DON'T"}
                          </Badge>
                          <SeverityIcon className={`h-3 w-3 ${severityColor}`} />
                          <span className={`text-[10px] ${severityColor}`}>{rule.severity || "info"}</span>
                        </div>
                        <p className="text-sm leading-relaxed">{rule.text}</p>
                      </div>
                      <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                          setEditingRule({ idx, data: rule });
                          setRuleForm({ text: rule.text, type: rule.type || "do", severity: rule.severity || "info" });
                          setRuleFormOpen(true);
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => setDeleteRuleDialog({ idx })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">暂无规则数据，点击"添加规则"开始</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ==================== Chapter Form Dialog ==================== */}
      <Dialog open={chapterFormOpen} onOpenChange={setChapterFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChapter ? "编辑章节" : "新增章节"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>章节编号</Label>
              <Input type="number" min="1" value={chapterForm.chapterNumber}
                onChange={(e) => setChapterForm({ ...chapterForm, chapterNumber: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>标题</Label>
              <Input value={chapterForm.title} onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })} placeholder="章节标题" />
            </div>
            <div className="space-y-2">
              <Label>分类</Label>
              <Select value={chapterForm.category} onValueChange={(v) => setChapterForm({ ...chapterForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChapterFormOpen(false)}>取消</Button>
            <Button onClick={() => {
              if (!chapterForm.title) { toast.error("请填写标题"); return; }
              if (editingChapter) {
                updateChapter.mutate({ chapterId: editingChapter.id, title: chapterForm.title, category: chapterForm.category as "universal" | "scene_specific" | "technical" | "ai_prompt" });
              } else {
                createChapter.mutate({ chapterNumber: chapterForm.chapterNumber, title: chapterForm.title, category: chapterForm.category as "universal" | "scene_specific" | "technical" | "ai_prompt" });
              }
            }} disabled={createChapter.isPending || updateChapter.isPending}>
              {(createChapter.isPending || updateChapter.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingChapter ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Delete Chapter Dialog ==================== */}
      <Dialog open={!!deleteChapterDialog} onOpenChange={(open) => !open && setDeleteChapterDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除章节</DialogTitle>
            <DialogDescription>
              确定要删除"第{deleteChapterDialog?.chapterNumber}章 · {deleteChapterDialog?.title}"吗？该章节下的所有规则也将被删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteChapterDialog(null)}>取消</Button>
            <Button variant="destructive" onClick={() => { if (deleteChapterDialog) deleteChapter.mutate({ chapterId: deleteChapterDialog.id }); }}
              disabled={deleteChapter.isPending}>
              {deleteChapter.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Rule Form Dialog ==================== */}
      <Dialog open={ruleFormOpen} onOpenChange={setRuleFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "编辑规则" : "添加规则"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>规则内容</Label>
              <Textarea value={ruleForm.text} onChange={(e) => setRuleForm({ ...ruleForm, text: e.target.value })} rows={3} placeholder="描述规则内容..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={ruleForm.type} onValueChange={(v) => setRuleForm({ ...ruleForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="do">DO (应该做)</SelectItem>
                    <SelectItem value="dont">DON'T (不应该做)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>严重性</Label>
                <Select value={ruleForm.severity} onValueChange={(v) => setRuleForm({ ...ruleForm, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical (严重)</SelectItem>
                    <SelectItem value="warning">Warning (警告)</SelectItem>
                    <SelectItem value="info">Info (提示)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRuleFormOpen(false); setEditingRule(null); }}>取消</Button>
            <Button onClick={() => {
              if (!ruleForm.text) { toast.error("请填写规则内容"); return; }
              const chapterId = chapterDetail.data?.id;
              if (editingRule && chapterId) {
                updateRule.mutate({
                  chapterId,
                  ruleIndex: editingRule.idx,
                  rule: ruleForm,
                });
              } else if (chapterId) {
                addRule.mutate({
                  chapterId,
                  rule: ruleForm,
                });
              }
            }} disabled={addRule.isPending || updateRule.isPending}>
              {(addRule.isPending || updateRule.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingRule ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Delete Rule Dialog ==================== */}
      <Dialog open={!!deleteRuleDialog} onOpenChange={(open) => !open && setDeleteRuleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除规则</DialogTitle>
            <DialogDescription>确定要删除这条规则吗？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRuleDialog(null)}>取消</Button>
            <Button variant="destructive" onClick={() => {
              const delChapterId = chapterDetail.data?.id;
              if (deleteRuleDialog && delChapterId) {
                deleteRule.mutate({ chapterId: delChapterId, ruleIndex: deleteRuleDialog.idx });
              }
            }} disabled={deleteRule.isPending}>
              {deleteRule.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Category Form Dialog ==================== */}
      <Dialog open={categoryFormOpen} onOpenChange={setCategoryFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "编辑分类" : "新增分类"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>分类Key（英文标识）</Label>
              <Input value={categoryForm.key} onChange={(e) => setCategoryForm({ ...categoryForm, key: e.target.value })}
                placeholder="如: character_design" disabled={!!editingCategory} />
            </div>
            <div className="space-y-2">
              <Label>分类名称</Label>
              <Input value={categoryForm.label} onChange={(e) => setCategoryForm({ ...categoryForm, label: e.target.value })}
                placeholder="如: 角色设计规则" />
            </div>
            <div className="space-y-2">
              <Label>描述（可选）</Label>
              <Textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="分类描述..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCategoryFormOpen(false); setEditingCategory(null); }}>取消</Button>
            <Button onClick={() => {
              if (!categoryForm.key || !categoryForm.label) { toast.error("请填写Key和名称"); return; }
              if (editingCategory) {
                updateCategory.mutate({ level: "1" as const, id: editingCategory, name: categoryForm.label, description: categoryForm.description });
              } else {
                createCategory.mutate({ level: "1" as const, id: categoryForm.key, name: categoryForm.label, description: categoryForm.description });
              }
            }} disabled={createCategory.isPending || updateCategory.isPending}>
              {(createCategory.isPending || updateCategory.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingCategory ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Delete Category Dialog ==================== */}
      <Dialog open={!!deleteCategoryDialog} onOpenChange={(open) => !open && setDeleteCategoryDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除分类</DialogTitle>
            <DialogDescription>
              确定要删除分类"{CATEGORY_LABELS[deleteCategoryDialog || ""] || deleteCategoryDialog}"吗？该分类下的章节将变为未分类。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCategoryDialog(null)}>取消</Button>
            <Button variant="destructive" onClick={() => { if (deleteCategoryDialog) deleteCategory.mutate({ level: "1" as const, id: deleteCategoryDialog }); }}
              disabled={deleteCategory.isPending}>
              {deleteCategory.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
