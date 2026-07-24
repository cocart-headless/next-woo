import type { Metadata } from "next";

import {
  getProducts,
  getAllProductCategories,
  getAllProductTags,
  getProductCategoryBySlug,
} from "@/lib/cocart";

import { Section, Container, Prose } from "@/components/craft";
import { ProductGrid, ProductFilters } from "@/components/shop";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse our product catalog",
};

export const dynamic = "auto";
export const revalidate = 600;

interface ShopPageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    tag?: string;
    search?: string;
    sort?: string;
    min_price?: string;
    max_price?: string;
  }>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const {
    page: pageParam,
    category,
    tag,
    search,
    sort,
    min_price,
    max_price,
  } = params;

  const page = pageParam ? parseInt(pageParam, 10) : 1;
  const productsPerPage = 12;

  // Parse sort parameter
  let orderby: "date" | "price" | "popularity" | "rating" | undefined;
  let order: "asc" | "desc" | undefined;

  switch (sort) {
    case "popularity":
      orderby = "popularity";
      break;
    case "rating":
      orderby = "rating";
      break;
    case "date":
      orderby = "date";
      order = "desc";
      break;
    case "price":
      orderby = "price";
      order = "asc";
      break;
    case "price-desc":
      orderby = "price";
      order = "desc";
      break;
  }

  // Resolve category slug for the page title (CoCart filters products by
  // slug directly, unlike WooCommerce's category-ID-based filtering)
  const categoryData = category ? await getProductCategoryBySlug(category) : undefined;

  // Fetch products and filter options
  const [productsResponse, categories, tags] = await Promise.all([
    getProducts(page, productsPerPage, {
      category,
      tag,
      search,
      orderby,
      order,
      min_price: min_price ? parseFloat(min_price) : undefined,
      max_price: max_price ? parseFloat(max_price) : undefined,
    }),
    getAllProductCategories(),
    getAllProductTags(),
  ]);

  const { data: products, headers } = productsResponse;
  const { total, totalPages } = headers;

  // Create pagination URL helper
  const createPaginationUrl = (newPage: number) => {
    const urlParams = new URLSearchParams();
    if (newPage > 1) urlParams.set("page", newPage.toString());
    if (category) urlParams.set("category", category);
    if (tag) urlParams.set("tag", tag);
    if (search) urlParams.set("search", search);
    if (sort) urlParams.set("sort", sort);
    if (min_price) urlParams.set("min_price", min_price);
    if (max_price) urlParams.set("max_price", max_price);
    return `/shop${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;
  };

  const pageTitle = categoryData?.name || "Shop";

  return (
    <Section>
      <Container>
        <div className="space-y-8">
          <Prose>
            <h1>{pageTitle}</h1>
            <p className="text-muted-foreground">
              {total} {total === 1 ? "product" : "products"} found
              {search && ` matching "${search}"`}
            </p>
          </Prose>

          <div className="grid lg:grid-cols-[280px_1fr] gap-8">
            {/* Sidebar Filters */}
            <aside className="space-y-6">
              <ProductFilters
                categories={categories}
                tags={tags}
                currentCategory={category}
                currentTag={tag}
                currentSearch={search}
                currentSort={sort}
                currentMinPrice={min_price}
                currentMaxPrice={max_price}
              />
            </aside>

            {/* Product Grid */}
            <div className="space-y-8">
              <ProductGrid products={products} columns={3} />

              {totalPages > 1 && (
                <div className="flex justify-center items-center py-8">
                  <Pagination>
                    <PaginationContent>
                      {page > 1 && (
                        <PaginationItem>
                          <PaginationPrevious
                            href={createPaginationUrl(page - 1)}
                          />
                        </PaginationItem>
                      )}

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((pageNum) => {
                          return (
                            pageNum === 1 ||
                            pageNum === totalPages ||
                            Math.abs(pageNum - page) <= 1
                          );
                        })
                        .map((pageNum, index, array) => {
                          const showEllipsis =
                            index > 0 && pageNum - array[index - 1] > 1;
                          return (
                            <div key={pageNum} className="flex items-center">
                              {showEllipsis && <span className="px-2">...</span>}
                              <PaginationItem>
                                <PaginationLink
                                  href={createPaginationUrl(pageNum)}
                                  isActive={pageNum === page}
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            </div>
                          );
                        })}

                      {page < totalPages && (
                        <PaginationItem>
                          <PaginationNext href={createPaginationUrl(page + 1)} />
                        </PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
