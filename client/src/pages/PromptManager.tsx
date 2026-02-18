import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Pencil, Save, Loader2, Languages, Eye, Copy, Check,
  Clapperboard, Image, Grid3x3, Video, ShieldCheck, Wrench
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  script: { label: "脚本生成", icon: Clapperboard, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  anchor: { label: "锚点生成", icon: Image, color: "bg-green-500/10 text-green-500 border-green-500/20" },
  grid: { label: "Grid生成", icon: Grid3x3, color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  prompt: { label: "Prompt生成", icon: Video, color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  validation: { label: "脚本校验", icon: ShieldCheck, color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  panel: { label: "面板修复", icon: Wrench, color: "bg-red-500/10 text-red-500 border-red-500/20" },
};

export default function PromptManager() {
  const { data: templates, isLoading } = trpc.promptTemplate.list.useQuery();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const templateDetail = trpc.promptTemplate.get.useQuery(
    { templateId: selectedTemplate! },
    { enabled: selectedTemplate !== null }
  );

  const translateMutation = trpc.promptTemplate.translate.useMutation({
    onSuccess: (data) => {
      setTranslatedContent(data.translated);
      toast.success("翻译完成");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Group templates by category
  const groupedTemplates = (() => {
    if (!templates) return {};
    const groups: Record<string, typeof templates> = {};
    for (const t of templates) {
      const cat = t.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return groups;
  })();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("已复制到剪贴板");
  };

  const handleTranslate = () => {
    const content = editMode ? editContent : templateDetail.data?.content;
    if (content) {
      setTranslatedContent(null);
      translateMutation.mutate({ text: content });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prompt管理</h1>
          <p className="text-muted-foreground mt-1">
            查看和管理工作流中使用的所有Prompt模板，支持翻译成中文
          </p>
        </div>
      </div>

      {/* Category Stats */}
      {templates && templates.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const count = groupedTemplates[key]?.length || 0;
            const Icon = config.icon;
            return (
              <Card key={key} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className={`text-xs ${config.color}`}>{config.label}</Badge>
                </div>
                <p className="text-lg font-bold">{count} <span className="text-sm font-normal text-muted-foreground">个模板</span></p>
              </Card>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : templates?.length ? (
        <div className="space-y-6">
          {Object.entries(groupedTemplates).map(([category, templateList]) => {
            const config = CATEGORY_CONFIG[category] || { label: category, icon: FileText, color: "" };
            const Icon = config.icon;
            return (
              <div key={category}>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <Badge variant="outline" className={config.color}>{config.label}</Badge>
                  <span className="text-sm text-muted-foreground font-normal">{templateList.length}个模板</span>
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {templateList.map((t: any) => (
                    <Card
                      key={t.id}
                      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
                      onClick={() => {
                        setSelectedTemplate(t.id);
                        setEditMode(false);
                        setTranslatedContent(null);
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>{t.name}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">暂无Prompt模板</p>
          </CardContent>
        </Card>
      )}

      {/* ==================== Template Detail Dialog ==================== */}
      <Dialog open={selectedTemplate !== null} onOpenChange={(open) => {
        if (!open) { setSelectedTemplate(null); setEditMode(false); setTranslatedContent(null); }
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {templates?.find(t => t.id === selectedTemplate)?.name || "Prompt模板"}
            </DialogTitle>
            <DialogDescription>
              {templates?.find(t => t.id === selectedTemplate)?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={handleTranslate} disabled={translateMutation.isPending}>
              {translateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Languages className="h-4 w-4 mr-1" />}
              翻译成中文
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleCopy(editMode ? editContent : (templateDetail.data?.content || ""))}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? "已复制" : "复制"}
            </Button>
            <Button size="sm" variant={editMode ? "default" : "outline"} onClick={() => {
              if (!editMode) {
                setEditContent(templateDetail.data?.content || "");
                setEditMode(true);
              } else {
                setEditMode(false);
              }
            }}>
              <Pencil className="h-4 w-4 mr-1" />
              {editMode ? "取消编辑" : "编辑"}
            </Button>
          </div>

          <ScrollArea className="max-h-[50vh]">
            {templateDetail.isLoading ? (
              <div className="space-y-2 py-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}</div>
            ) : editMode ? (
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="输入Prompt内容..."
              />
            ) : (
              <div className="bg-muted/50 rounded-lg p-4">
                <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{templateDetail.data?.content}</pre>
              </div>
            )}

            {/* Translation result */}
            {translatedContent && (
              <>
                <Separator className="my-4" />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Languages className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">中文翻译</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleCopy(translatedContent)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4">
                    <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{translatedContent}</pre>
                  </div>
                </div>
              </>
            )}
          </ScrollArea>

          {editMode && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditMode(false)}>取消</Button>
              <Button onClick={() => {
                // For now, show a toast since prompt templates are currently hardcoded
                // In a future version, these could be stored in the database
                toast.info("Prompt模板修改功能即将上线，当前模板为系统默认值");
                setEditMode(false);
              }}>
                <Save className="h-4 w-4 mr-1" />
                保存修改
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
