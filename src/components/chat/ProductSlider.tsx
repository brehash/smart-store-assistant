import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ShoppingCart, Eye } from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: string;
  regular_price?: string;
  images?: { src: string }[];
  stock_status?: string;
  short_description?: string;
  categories?: { name: string }[];
}

export function ProductSlider({ products }: { products: Product[] }) {
  if (!products?.length) return null;

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-3 pb-4">
        {products.map((product) => (
          <Card key={product.id} className="w-[200px] shrink-0 overflow-hidden">
            <div className="relative h-[140px] bg-muted">
              {product.images?.[0]?.src ? (
                <img
                  src={product.images[0].src}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
                  No image
                </div>
              )}
              {product.stock_status && (
                <Badge
                  className="absolute top-2 right-2 text-[10px]"
                  variant={product.stock_status === "instock" ? "default" : "destructive"}
                >
                  {product.stock_status === "instock" ? "In Stock" : "Out of Stock"}
                </Badge>
              )}
            </div>
            <CardContent className="p-3">
              <p className="text-sm font-medium truncate mb-1">{product.name}</p>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-sm font-bold text-primary">{product.price} lei</span>
                {product.regular_price && product.regular_price !== product.price && (
                  <span className="text-xs text-muted-foreground line-through">
                    {product.regular_price} lei
                  </span>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                  <Eye className="h-3 w-3 mr-1" /> View
                </Button>
                <Button size="sm" className="flex-1 h-7 text-xs">
                  <ShoppingCart className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
