import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PostReviewEditor } from "./PostReviewEditor";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const post = await prisma.blogPost.findUnique({ where: { id }, select: { title: true } });
  return { title: post ? `${post.title} — TensorWorks Admin` : "Post — TensorWorks Admin" };
}

export default async function ContentPostPage({ params }: Props) {
  const { id } = await params;

  const post = await prisma.blogPost.findUnique({
    where: { id },
    include: {
      generationLog: true,
    },
  });

  if (!post) {
    notFound();
  }

  // Fetch next pending_review post for the [N] shortcut
  const nextPost = await prisma.blogPost.findFirst({
    where: { status: "pending_review", id: { not: id } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return (
    <PostReviewEditor
      post={{
        id: post.id,
        title: post.title,
        subtitle: post.subtitle ?? "",
        body: post.body,
        tier: post.tier,
        category: post.category,
        status: post.status,
        wordCount: post.wordCount,
        modelUsed: post.modelUsed ?? null,
        generationCost: post.generationCost ?? null,
        promptTokens: post.promptTokens ?? null,
        completionTokens: post.completionTokens ?? null,
        reviewNotes: post.reviewNotes ?? "",
        citations: post.citations as Array<{ title: string; url: string; accessed: string }>,
        generationLog: post.generationLog
          ? {
              qualityScore: post.generationLog.qualityScore ?? null,
              qualityReport: post.generationLog.qualityReport as Record<string, unknown> | null,
            }
          : null,
      }}
      nextPostId={nextPost?.id ?? null}
    />
  );
}
