import { getPageBySlug, getAllPages } from "@/lib/wordpress";
import { generateContentMetadata } from "@/lib/metadata";
import { Section, Container, Prose } from "@/components/craft";
import { notFound } from "next/navigation";

import type { Metadata } from "next";

// Revalidate pages every hour
export const revalidate = 3600;

// WooCommerce's own auto-created "Cart"/"Checkout"/"My account" pages are
// redundant here - this app has first-party /cart, /checkout, and /account
// routes instead.
const EXCLUDED_SLUGS = ["cart", "checkout", "my-account"];

export async function generateStaticParams() {
  const pages = await getAllPages();

  return pages
    .filter((page) => !EXCLUDED_SLUGS.includes(page.slug))
    .map((page) => ({
      slug: page.slug,
    }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (EXCLUDED_SLUGS.includes(slug)) {
    return {};
  }
  const page = await getPageBySlug(slug);

  if (!page) {
    return {};
  }

  return generateContentMetadata({
    title: page.title.rendered,
    excerpt: page.excerpt?.rendered,
    content: page.content.rendered,
    slug: page.slug,
    type: "page",
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (EXCLUDED_SLUGS.includes(slug)) {
    notFound();
  }
  const page = await getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  return (
    <Section>
      <Container>
        <Prose>
          <h2>{page.title.rendered}</h2>
          <div dangerouslySetInnerHTML={{ __html: page.content.rendered }} />
        </Prose>
      </Container>
    </Section>
  );
}
