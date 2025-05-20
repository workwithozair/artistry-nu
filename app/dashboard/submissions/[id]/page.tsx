import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export default async function SubmissionDetailPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  const { data: submission, error } = await supabase
    .from("submissions")
    .select(`
      *,
      tournaments (
        id,
        title,
        submission_deadline
      ),
      submission_files (
        id,
        file_name,
        file_path,
        file_type
      )
    `)
    .eq("id", params.id)
    .single()

  if (error || !submission) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Submission Not Found</CardTitle>
            <CardDescription>The submission you are looking for does not exist.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/dashboard/submissions">
              <Button>Back to Submissions</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Check if this submission belongs to the current user
  if (submission.user_id !== session.user.id) {
    redirect("/dashboard/submissions")
  }

  // Get file URL if there are submission files
  let fileUrl = null
  if (submission.submission_files && submission.submission_files.length > 0) {
    const { data } = await supabase.storage
      .from("submission-files")
      .createSignedUrl(submission.submission_files[0].file_path, 60)

    fileUrl = data?.signedUrl
  }

  // Get certificate if available
  const { data: certificate } = await supabase.from("certificates").select("*").eq("submission_id", params.id).single()

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{submission.title}</CardTitle>
              <CardDescription>Submission Details</CardDescription>
            </div>
            <Badge
              className={
                submission.status === "pending"
                  ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                  : submission.status === "approved"
                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                    : submission.status === "rejected"
                      ? "bg-red-100 text-red-800 hover:bg-red-100"
                      : "bg-blue-100 text-blue-800 hover:bg-blue-100"
              }
            >
              {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose dark:prose-invert">
            <p>{submission.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium">Tournament</h3>
              <p className="text-sm text-muted-foreground">{submission.tournaments.title}</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Submission Date</h3>
              <p className="text-sm text-muted-foreground">{new Date(submission.created_at).toLocaleDateString()}</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Deadline</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(submission.tournaments.submission_deadline).toLocaleDateString()}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Score</h3>
              <p className="text-sm text-muted-foreground">
                {submission.score ? `${submission.score}/100` : "Not scored yet"}
              </p>
            </div>
          </div>

          {submission.feedback && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Feedback</h3>
              <p className="text-sm text-muted-foreground">{submission.feedback}</p>
            </div>
          )}

          {submission.submission_files && submission.submission_files.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Submitted Files</h3>
              <ul className="space-y-2">
                {submission.submission_files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between">
                    <span className="text-sm">{file.file_name}</span>
                    {fileUrl && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View File
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {certificate && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Certificate</h3>
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm">
                  Certificate #{certificate.certificate_number} - Issued on{" "}
                  {new Date(certificate.issue_date).toLocaleDateString()}
                </p>
                {certificate.file_path && (
                  <div className="mt-2">
                    <Link href={`/dashboard/certificates/${certificate.id}`}>
                      <Button variant="outline" size="sm">
                        View Certificate
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Link href="/dashboard/submissions">
            <Button variant="outline">Back to Submissions</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
