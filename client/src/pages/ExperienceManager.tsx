import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, RefreshCw, Loader2, Lightbulb, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ACTION_TYPE_MAP: Record<string, string> = {
  panel_fix: "面板修复",
  grid_regenerate: "Grid重新生成",
  script_edit: "脚本编辑",
  prompt_edit: "Prompt编辑",
};

export default function ExperienceManager() {
  const [filterAction, setFilterAction] = useState<string>("");
  const { data: records, isLoading, refetch } = trpc.experience.list.useQuery(
    filterAction ? { actionType: filterAction } : {}
  );
  const { data: summary, isLoading: summaryLoading } = trpc.experience.summary.useQuery();
  const { data: userRules, isLoading: rulesLoading, refetch: refetchRules } = trpc.rule.userRules.useQuery({});

  const extractRules = trpc.experience.extractRules.useMutation({
    onSuccess: (data) => {
      toast.success(`提炼出 ${data.rules?.length ?? 0} 条新规则`);
      refetchRules();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const approveRule = trpc.rule.approveRule.useMutation({
    onSuccess: () => { toast.success("规则已批准"); refetchRules(); },
    onError: (err: any) => toast.error(err.message),
  });

  const rejectRule = trpc.rule.rejectRule.useMutation({
    onSuccess: () => { toast.success("规则已拒绝"); refetchRules(); },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">经验管理</h1>
        <p className="text-muted-foreground mt-1">标注调整中积累的经验记录，可提炼为新规则</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {summaryLoading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">总记录数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.total ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">面板修复</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.byActionType?.find((a: any) => a.type === 'panel_fix')?.count ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Grid重生成</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.byActionType?.find((a: any) => a.type === 'grid_regenerate')?.count ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">提炼规则数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userRules?.length ?? 0}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Extract Rules Button */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            规则提炼
          </CardTitle>
          <Button
            onClick={() => extractRules.mutate()}
            disabled={extractRules.isPending || !records?.length}
          >
            {extractRules.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            从经验中提炼规则
          </Button>
        </CardHeader>
        <CardContent>
          {userRules && userRules.length > 0 ? (
            <div className="space-y-2">
              {userRules.map((rule: any) => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={rule.ruleType === "do" ? "default" : "destructive"} className="text-xs">
                        {rule.ruleType === "do" ? "DO" : "DON'T"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{rule.severity}</Badge>
                      <Badge variant={
                        rule.status === "approved" ? "default" :
                        rule.status === "rejected" ? "destructive" : "secondary"
                      } className="text-xs">
                        {rule.status === "approved" ? "已批准" : rule.status === "rejected" ? "已拒绝" : "待审核"}
                      </Badge>
                    </div>
                    <p className="text-sm">{rule.ruleText}</p>
                  </div>
                  {rule.status === "pending" && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600"
                        onClick={() => approveRule.mutate({ ruleId: rule.id })}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-600"
                        onClick={() => rejectRule.mutate({ ruleId: rule.id })}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              暂无提炼的规则。积累足够的经验记录后，点击"从经验中提炼规则"开始。
            </p>
          )}
        </CardContent>
      </Card>

      {/* Experience Records */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">经验记录</CardTitle>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="panel_fix">面板修复</SelectItem>
              <SelectItem value="grid_regenerate">Grid重生成</SelectItem>
              <SelectItem value="script_edit">脚本编辑</SelectItem>
              <SelectItem value="prompt_edit">Prompt编辑</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : records?.length ? (
            <div className="space-y-2">
              {records.map((r: any) => (
                <div key={r.id} className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {ACTION_TYPE_MAP[r.actionType] || r.actionType}
                    </Badge>
                    {r.panelIndex != null && (
                      <Badge variant="secondary" className="text-xs">面板 #{r.panelIndex + 1}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  {r.issueDescription && (
                    <p className="text-sm"><span className="font-medium text-destructive">问题:</span> {r.issueDescription}</p>
                  )}
                  {r.fixDescription && (
                    <p className="text-sm"><span className="font-medium text-green-600">修复:</span> {r.fixDescription}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">暂无经验记录</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
