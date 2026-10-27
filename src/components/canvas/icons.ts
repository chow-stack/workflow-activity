import {
  Clock,
  FileText,
  Filter,
  GitBranch,
  Hash,
  Layers,
  Mail,
  PenLine,
  Repeat,
  Rows3,
  ScanText,
  Send,
  Split,
  Table,
  Tags,
  type LucideIcon,
} from "lucide-react";
import type { Category, NodeType } from "@/engine/types";

export const NODE_ICON: Record<NodeType, LucideIcon> = {
  "trigger.form": FileText,
  "trigger.email": Mail,
  "trigger.schedule": Clock,
  "data.readSheet": Table,
  "data.forEach": Repeat,
  "data.combine": Layers,
  "logic.filter": Filter,
  "logic.ifElse": GitBranch,
  "logic.switch": Split,
  "ai.classify": Tags,
  "ai.extract": ScanText,
  "ai.write": PenLine,
  "action.email": Send,
  "action.slack": Hash,
  "action.sheetRow": Rows3,
};

export const CATEGORY_COLOR: Record<Category, string> = {
  trigger: "var(--color-cat-trigger)",
  data: "var(--color-cat-data)",
  logic: "var(--color-cat-logic)",
  ai: "var(--color-cat-ai)",
  action: "var(--color-cat-action)",
};
