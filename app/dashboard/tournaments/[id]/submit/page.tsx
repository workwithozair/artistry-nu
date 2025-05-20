"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Upload, Loader2 } from "lucide-react"
import { DatePicker } from "@/components/ui/date-picker"
import { format } from "date-fns"
import { ref, uploadBytes } from "firebase/storage"
import { db, storage } from "@/lib/firebase/client"
import { addDoc, collection, doc, updateDoc } from "firebase/firestore"

export default function SubmitToTournamentPage() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [applicantName, setApplicantName] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>()
  const [phoneNumber, setPhoneNumber] = useState("")
  const [files, setFiles] = useState<FileList | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const router = useRouter()
  const params = useParams()
  const { data: session } = useSession()
  const { toast } = useToast()
  const tournamentId = params.id as string

  const loadRazorpay = () =>
    new Promise((resolve) => {
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })

  const triggerPayment = async (submissionId: string) => {
    const res = await fetch("/api/payment/order", {
      method: "POST",
      body: JSON.stringify({ amount: 10000, submissionId }), // 10000 = ₹100 in paise
    })

    const data = await res.json()
    const isScriptLoaded = await loadRazorpay()

    if (!isScriptLoaded || !data.id) {
      toast({
        title: "Payment failed",
        description: "Razorpay script load or order creation failed.",
        variant: "destructive",
      })
      return
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      amount: data.amount,
      currency: data.currency,
      name: "Art Tournament",
      description: "Entry Fee",
      order_id: data.id,
      handler: async function (response: any) {
        const refDoc = doc(db, "submissions", submissionId)
        await updateDoc(refDoc, {
          payment_status: "paid",
            status: "paid",
            paid_amount: data.amount,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        })

        toast({ title: "Payment Successful", description: "Thank you!" })
        router.push(`/dashboard/tournaments/${tournamentId}/payment/success?submissionId=${submissionId}`)
      },
      prefill: {
        name: applicantName,
        email: session?.user?.email ?? "",
      },
      theme: {
        color: "#6366f1",
      },
    }

    const razorpay = new (window as any).Razorpay(options)
    razorpay.open()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (!session?.user?.email) {
        toast({
          title: "Not Authenticated",
          description: "You must be logged in.",
          variant: "destructive",
        })
        return
      }

      if (!dateOfBirth) throw new Error("Date of birth is required")

      const userId = session.user.id
      const submissionRef = await addDoc(collection(db, "submissions"), {
        title,
        description,
        applicant_name: applicantName,
        date_of_birth: format(dateOfBirth, "yyyy-MM-dd"),
        phone_number: phoneNumber,
        user_id: userId,
        tournament_id: tournamentId,
        status: "pending",
        payment_status: "unpaid",
        created_at: new Date(),
      })

      if (files && files.length > 0) {
        setIsUploading(true)

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const filePath = `submissions/${userId}/${submissionRef.id}/${file.name}`
          const fileRef = ref(storage, filePath)

          await uploadBytes(fileRef, file)

          await addDoc(collection(db, "submission_files"), {
            submission_id: submissionRef.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_at: new Date(),
          })
        }
      }

      toast({ title: "Submission Received", description: "Proceeding to payment..." })
      await triggerPayment(submissionRef.id)
    } catch (error) {
      console.error(error)
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
      setIsUploading(false)
    }
  }

  return (
    <div className="container max-w-3xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Submit Your Artwork</CardTitle>
          <CardDescription>Complete this form to submit your artwork to the tournament.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="applicantName">Applicant Name*</Label>
                <Input id="applicantName" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth*</Label>
                <DatePicker
                  id="dateOfBirth"
                  selected={dateOfBirth}
                  onSelect={setDateOfBirth}
                  required
                  maxDate={new Date()}
                  fromYear={1900}
                  toYear={new Date().getFullYear() - 10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  pattern="[0-9]{10}"
                  placeholder="10-digit number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title of Your Work*</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description*</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="files">Upload Files*</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center justify-center">
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 mb-2">Drag and drop or click to upload</p>
                <Input
                  id="files"
                  type="file"
                  className="hidden"
                  onChange={(e) => setFiles(e.target.files)}
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf,.svg"
                  required
                />
                <Button type="button" variant="outline" onClick={() => document.getElementById("files")?.click()}>
                  Select Files
                </Button>
              </div>
              {files && (
                <ul className="text-sm mt-2 text-gray-500 list-disc list-inside">
                  {Array.from(files).map((file, idx) => (
                    <li key={idx}>
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting || isUploading} className="w-full">
              {isUploading || isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUploading ? "Uploading Files..." : "Submitting..."}
                </>
              ) : (
                "Submit and Pay ₹100"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
