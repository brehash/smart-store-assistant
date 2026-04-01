export interface SemanticStep {
  title: string;
  details?: string;
}

export const WRITE_TOOLS = new Set([
  "create_order",
  "update_order_status",
  "update_order",
  "delete_order",
  "create_product",
  "update_product",
  "delete_product",
  "create_page",
  "update_page",
  "delete_page",
  "create_post",
  "update_post",
  "delete_post",
]);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
