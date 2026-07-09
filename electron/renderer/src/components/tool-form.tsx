// src/components/tool-form.tsx — 动态 zod schema 表单 (Ctrl+K 选工具后弹这个)
import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { apiPost } from '../lib/api';
import { pushToast } from './Toast';
import { cn } from '../lib/cn';

interface Props {
  tool: { name: string; description?: string; parameters?: any } | null;
  onClose: () => void;
}

interface FieldState { [key: string]: string; }

function extractFields(parameters: any): Array<{ name: string; label: string; type: string; required: boolean; description?: string; default?: any; enum?: any[] }> {
  if (!parameters) return [];
  // zod 转换的 schema 是 _def.shape, 或直接是 JSON Schema
  if (parameters.properties) {
    // JSON Schema 形态
    return Object.entries(parameters.properties).map(([name, p]: [string, any]) => ({
      name,
      label: p.title || name,
      type: p.type || 'string',
      required: (parameters.required || []).includes(name),
      description: p.description,
      default: p.default,
      enum: p.enum,
    }));
  }
  // zod _def.shape 形态
  if (parameters._def?.shape) {
    const shape = typeof parameters._def.shape === 'function' ? parameters._def.shape() : parameters._def.shape;
    return Object.entries(shape).map(([name, def]: [string, any]) => {
      const typeName = def?._def?.typeName || 'ZodString';
      const typeMap: Record<string, string> = {
        ZodString: 'string', ZodNumber: 'number', ZodBoolean: 'boolean',
        ZodEnum: 'enum', ZodArray: 'array', ZodObject: 'object',
      };
      const checks = def?._def?.checks || [];
      const isOptional = def?._def?.typeName === 'ZodOptional';
      const inner = isOptional ? def._def.innerType : def;
      const innerType = inner?._def?.typeName || typeName;
      return {
        name,
        label: def?.description || name,
        type: typeMap[innerType] || 'string',
        required: !isOptional,
        description: def?.description,
        default: inner?._def?.defaultValue?.(),
        enum: inner?._def?.values && Object.values(inner._def.values),
      };
    });
  }
  return [];
}

export function ToolForm({ tool, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fields = tool ? extractFields(tool.parameters) : [];
  const initialState: FieldState = {};
  fields.forEach((f) => { initialState[f.name] = f.default != null ? String(f.default) : ''; });
  const [values, setValues] = useState<FieldState>(initialState);

  const submit = async () => {
    if (!tool) return;
    setBusy(true);
    setResult(null);
    try {
      const args: any = {};
      for (const f of fields) {
        const v = values[f.name];
        if (v === '' && !f.required) continue;
        if (f.type === 'number') args[f.name] = Number(v);
        else if (f.type === 'boolean') args[f.name] = v === 'true' || v === '1';
        else if (f.type === 'array') args[f.name] = v.split(',').map((s) => s.trim());
        else if (f.type === 'object') { try { args[f.name] = JSON.parse(v); } catch { args[f.name] = v; } }
        else args[f.name] = v;
      }
      const r = await apiPost('/api/tools/call', { name: tool.name, args });
      setResult(r);
      if (r.ok) pushToast({ kind: 'success', title: `✓ ${tool.name} 完成` });
      else pushToast({ kind: 'error', title: `✗ ${tool.name}`, description: r.error });
    } catch (e: any) {
      setResult({ ok: false, error: e.message });
      pushToast({ kind: 'error', title: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (!tool) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">{tool.name}</DialogTitle>
          {tool.description && <DialogDescription>{tool.description}</DialogDescription>}
        </DialogHeader>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto px-1">
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground">此工具无需参数,直接点"执行"</p>
          )}
          {fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs">
                <span className="font-medium">{f.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{f.name}</span>
                {f.required && <span className="text-destructive">*</span>}
                <span className="ml-auto text-[10px] text-muted-foreground">{f.type}</span>
              </label>
              {f.enum ? (
                <select
                  value={values[f.name] || ''}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  <option value="">(默认)</option>
                  {f.enum.map((v) => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
                </select>
              ) : (
                <Input
                  value={values[f.name] || ''}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  placeholder={f.description || (f.type === 'object' ? '{"key": "value"}' : '')}
                  className={cn('font-mono text-xs', f.type === 'object' || f.type === 'array' ? 'h-16' : '')}
                />
              )}
              {f.description && <p className="text-[10px] text-muted-foreground">{f.description}</p>}
            </div>
          ))}

          {result && (
            <div className={cn(
              'rounded-md border p-2.5 text-[11px]',
              result.ok ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
            )}>
              <div className="font-medium">{result.ok ? '✓ 成功' : '✗ 失败'}</div>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px]">
{result.ok ? JSON.stringify(result.value, null, 2).slice(0, 800) : result.error}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
          <Button size="sm" onClick={submit} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            执行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}