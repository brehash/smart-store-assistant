import React, { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";

import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Minus, X, ChevronDown, ShoppingCart, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductResult {
  id: number;
  name: string;
  sku: string;
  price: string;
  regular_price: string;
  stock_status: string;
  images?: { src: string }[];
}

interface LineItem {
  product_id: number;
  name: string;
  sku: string;
  price: string;
  quantity: number;
}

export interface OrderFormData {
  toolCallId: string;
  stepIndex: number;
  prefill?: any;
  resolved?: { orderNumber: string; orderId: number; total: string } | "error";
}

interface PaymentMethod {
  id: string;
  title: string;
}

interface OrderFormCardProps {
  data: OrderFormData;
  orderStatuses?: string[];
  allOrderStatuses?: { slug: string; name: string }[];
  paymentMethods?: PaymentMethod[];
  cachedProducts?: any[];
  disabled?: boolean;
  onOrderCreated?: (data: OrderFormData, result: { orderNumber: string; orderId: number; total: string }) => void;
}

export function OrderFormCard({ data, orderStatuses, allOrderStatuses, paymentMethods, cachedProducts, disabled, onOrderCreated }: OrderFormCardProps) {
  const { session } = useAuth();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [status, setStatus] = useState("processing");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [note, setNote] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [billingOpen, setBillingOpen] = useState(false);
  const [billing, setBilling] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    address_1: "", city: "", state: "", postcode: "", country: "",
    company: "",
  });
  const [shippingDiffers, setShippingDiffers] = useState(false);
  const [shipping, setShipping] = useState({
    first_name: "", last_name: "", phone: "",
    address_1: "", city: "", state: "", postcode: "", country: "",
    company: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const resultsRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim() || !session) return;
    const q = query.toLowerCase();
    // Search cached products first
    if (cachedProducts && cachedProducts.length > 0) {
      const localResults = cachedProducts.filter((p: any) =>
        p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
      ).slice(0, 10);
      if (localResults.length > 0) {
        setSearchResults(localResults);
        setShowResults(true);
        setSearching(false);
        return;
      }
    }
    // Fall back to live API
    setSearching(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: `products?search=${encodeURIComponent(query)}&per_page=10` },
      });
      if (!error && Array.isArray(result)) {
        setSearchResults(result);
        setShowResults(true);
      }
    } catch { /* silent */ }
    finally { setSearching(false); }
  }, [session, cachedProducts]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length >= 2) {
      searchTimeout.current = setTimeout(() => searchProducts(value), 400);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const addProduct = (product: ProductResult) => {
    setLineItems((prev) => {
      const existing = prev.find((li) => li.product_id === product.id);
      if (existing) {
        return prev.map((li) => li.product_id === product.id ? { ...li, quantity: li.quantity + 1 } : li);
      }
      return [...prev, { product_id: product.id, name: product.name, sku: product.sku, price: product.price, quantity: 1 }];
    });
    setSearchQuery("");
    setShowResults(false);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setLineItems((prev) => prev.map((li) => {
      if (li.product_id !== productId) return li;
      const newQty = Math.max(1, li.quantity + delta);
      return { ...li, quantity: newQty };
    }));
  };

  const removeItem = (productId: number) => {
    setLineItems((prev) => prev.filter((li) => li.product_id !== productId));
  };

  const total = lineItems.reduce((sum, li) => sum + parseFloat(li.price || "0") * li.quantity, 0);

  const handleSubmit = async () => {
    if (lineItems.length === 0 || !session) return;
    setSubmitting(true);
    setError(null);
    try {
      const orderBody: any = {
        status,
        line_items: lineItems.map((li) => ({ product_id: li.product_id, quantity: li.quantity })),
      };
      if (note) orderBody.customer_note = note;
      if (couponCode.trim()) orderBody.coupon_lines = [{ code: couponCode.trim() }];
      if (paymentMethod) {
        orderBody.payment_method = paymentMethod;
        const pm = paymentMethods?.find((p) => p.id === paymentMethod);
        if (pm) orderBody.payment_method_title = pm.title;
      }
      const hasBilling = Object.values(billing).some((v) => v.trim());
      if (hasBilling) orderBody.billing = billing;

      const { data: result, error: invokeError } = await supabase.functions.invoke("woo-proxy", {
        body: { endpoint: "orders", method: "POST", body: orderBody },
      });
      if (invokeError) throw new Error(invokeError.message || "Failed to create order");
      if (result?.id) {
        const orderResult = { orderNumber: result.number || String(result.id), orderId: result.id, total: result.total || String(total) };
        onOrderCreated?.(data, orderResult);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  // Resolved state
  if (data.resolved && data.resolved !== "error") {
    return (
      <Card className="border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5">
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />
          <div>
            <p className="font-medium text-sm">Order #{data.resolved.orderNumber} created</p>
            <p className="text-xs text-muted-foreground">Total: {data.resolved.total}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isDisabled = disabled || submitting;

  return (
    <Card className="w-full max-w-lg border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingCart className="h-4 w-4" />
          Create Order
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product Search */}
        <div className="relative" ref={resultsRef}>
          <Label className="text-xs font-medium mb-1.5 block">Products</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9 text-sm"
              disabled={isDisabled}
            />
            {searching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
              <div className="max-h-48 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                  >
                    {p.images?.[0]?.src && (
                      <img src={p.images[0].src} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                    </div>
                    <span className="text-xs font-medium shrink-0">{p.price} lei</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        {lineItems.length > 0 && (
          <div className="space-y-2">
            {lineItems.map((li) => (
              <div key={li.product_id} className="flex items-center gap-2 rounded-lg border bg-card p-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{li.name}</p>
                  <p className="text-xs text-muted-foreground">{li.price} lei × {li.quantity}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(li.product_id, -1)} disabled={isDisabled}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm tabular-nums">{li.quantity}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(li.product_id, 1)} disabled={isDisabled}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(li.product_id)} disabled={isDisabled}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between text-sm font-medium pt-1 px-1">
              <span>Total</span>
              <span>{total.toFixed(2)} lei</span>
            </div>
          </div>
        )}

        {/* Status */}
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Status</Label>
          <Select value={status} onValueChange={setStatus} disabled={isDisabled}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(() => {
                const preferred = orderStatuses || [];
                const all = allOrderStatuses || [];
                const allSlugs = all.map((s) => s.slug);
                const preferredSet = new Set(preferred);
                // Preferred first, then the rest
                const sorted = [
                  ...all.filter((s) => preferredSet.has(s.slug)),
                  ...all.filter((s) => !preferredSet.has(s.slug)),
                ];
                if (sorted.length === 0) {
                  return ["pending", "processing", "on-hold", "completed"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ));
                }
                return sorted.map((s, i) => {
                  const isPreferred = preferredSet.has(s.slug);
                  const isFirstNonPreferred = !isPreferred && (i === 0 || preferredSet.has(sorted[i - 1].slug));
                  return (
                    <React.Fragment key={s.slug}>
                      {isFirstNonPreferred && preferred.length > 0 && (
                        <div className="my-1 h-px bg-border mx-2" />
                      )}
                      <SelectItem value={s.slug}>
                        <span className={isPreferred ? "font-medium" : ""}>{s.name}</span>
                      </SelectItem>
                    </React.Fragment>
                  );
                });
              })()}
            </SelectContent>
          </Select>
        </div>

        {/* Payment Method */}
        {paymentMethods && paymentMethods.length > 0 && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={isDisabled}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select payment method..." />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((pm) => (
                  <SelectItem key={pm.id} value={pm.id}>{pm.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Coupon / Voucher */}
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Voucher / Coupon (optional)</Label>
          <Input placeholder="Enter coupon code..." value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="h-9 text-sm" disabled={isDisabled} />
        </div>

        {/* Note */}
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Order Note (optional)</Label>
          <Textarea placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} className="text-sm min-h-[60px]" disabled={isDisabled} />
        </div>

        {/* Billing - collapsible */}
        <Collapsible open={billingOpen} onOpenChange={setBillingOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={cn("h-3 w-3 transition-transform", billingOpen && "rotate-180")} />
            Customer Details (optional)
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">First Name</Label>
                <Input className="h-8 text-sm" value={billing.first_name} onChange={(e) => setBilling((b) => ({ ...b, first_name: e.target.value }))} disabled={isDisabled} />
              </div>
              <div>
                <Label className="text-xs">Last Name</Label>
                <Input className="h-8 text-sm" value={billing.last_name} onChange={(e) => setBilling((b) => ({ ...b, last_name: e.target.value }))} disabled={isDisabled} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input className="h-8 text-sm" type="email" value={billing.email} onChange={(e) => setBilling((b) => ({ ...b, email: e.target.value }))} disabled={isDisabled} />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input className="h-8 text-sm" value={billing.phone} onChange={(e) => setBilling((b) => ({ ...b, phone: e.target.value }))} disabled={isDisabled} />
            </div>
            <div>
              <Label className="text-xs">Address</Label>
              <Input className="h-8 text-sm" value={billing.address_1} onChange={(e) => setBilling((b) => ({ ...b, address_1: e.target.value }))} disabled={isDisabled} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">City</Label>
                <Input className="h-8 text-sm" value={billing.city} onChange={(e) => setBilling((b) => ({ ...b, city: e.target.value }))} disabled={isDisabled} />
              </div>
              <div>
                <Label className="text-xs">State / County</Label>
                <Input className="h-8 text-sm" value={billing.state} onChange={(e) => setBilling((b) => ({ ...b, state: e.target.value }))} disabled={isDisabled} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Postcode</Label>
                <Input className="h-8 text-sm" value={billing.postcode} onChange={(e) => setBilling((b) => ({ ...b, postcode: e.target.value }))} disabled={isDisabled} />
              </div>
              <div>
                <Label className="text-xs">Country</Label>
                <Input className="h-8 text-sm" value={billing.country} onChange={(e) => setBilling((b) => ({ ...b, country: e.target.value }))} disabled={isDisabled} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={isDisabled || lineItems.length === 0} className="w-full">
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating...</> : "Create Order"}
        </Button>
      </CardContent>
    </Card>
  );
}
